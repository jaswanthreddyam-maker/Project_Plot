from __future__ import annotations

import asyncio
import contextlib
import json
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.auth import get_current_user
from backend.engine.executor import execute_flow_graph

router = APIRouter(tags=["Flow Execution"])


class FlowNode(BaseModel):
    id: str
    type: str | None = None
    data: Dict[str, Any] = Field(default_factory=dict)


class FlowEdge(BaseModel):
    id: str | None = None
    source: str
    target: str


class ExecuteFlowRequest(BaseModel):
    nodes: List[FlowNode] = Field(default_factory=list)
    edges: List[FlowEdge] = Field(default_factory=list)
    initial_input: Any = None


class ExecuteFlowResponse(BaseModel):
    logs: List[Dict[str, Any]]
    outputs_by_node: Dict[str, Any]
    final_output: Any
    execution_order: List[str]


def _as_json(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, default=str)


@router.post("/api/execute-flow", response_model=ExecuteFlowResponse)
async def execute_flow(
    req: ExecuteFlowRequest,
    current_user: str = Depends(get_current_user),
):
    result = await execute_flow_graph(
        nodes=[node.model_dump() for node in req.nodes],
        edges=[edge.model_dump() for edge in req.edges],
        initial_input=req.initial_input,
    )
    return {
        "logs": result.logs,
        "outputs_by_node": result.outputs_by_node,
        "final_output": result.final_output,
        "execution_order": result.execution_order,
    }


@router.post("/api/execute-flow/stream")
async def execute_flow_stream(
    req: ExecuteFlowRequest,
    current_user: str = Depends(get_current_user),
):
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def on_log(log: Dict[str, Any]) -> None:
        await queue.put(f"data: {_as_json({'type': 'log', 'log': log})}\n\n")

    async def run() -> None:
        try:
            result = await execute_flow_graph(
                nodes=[node.model_dump() for node in req.nodes],
                edges=[edge.model_dump() for edge in req.edges],
                initial_input=req.initial_input,
                on_log=on_log,
            )
            await queue.put(
                "data: "
                + _as_json(
                    {
                        "type": "completed",
                        "logs": result.logs,
                        "outputs_by_node": result.outputs_by_node,
                        "final_output": result.final_output,
                        "execution_order": result.execution_order,
                    }
                )
                + "\n\n"
            )
        except HTTPException as exc:
            await queue.put(
                f"data: {_as_json({'type': 'error', 'status_code': exc.status_code, 'detail': exc.detail})}\n\n"
            )
        except Exception as exc:  # pragma: no cover - safety net
            await queue.put(
                f"data: {_as_json({'type': 'error', 'status_code': 500, 'detail': str(exc)})}\n\n"
            )
        finally:
            await queue.put(None)

    task = asyncio.create_task(run())

    async def stream():
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            if not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
