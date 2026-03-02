from __future__ import annotations

from collections import defaultdict, deque
from typing import Any, Dict, List, Mapping

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth import get_current_user
from backend.engine.tools import (
    execute_classifier,
    execute_data_mapper,
    execute_http_request,
    execute_slack_action,
    execute_summarizer,
    execute_webhook,
)

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


def _preview(value: Any, max_length: int = 220) -> str:
    text = str(value)
    if len(text) <= max_length:
        return text
    return f"{text[:max_length]}..."


def _topological_sort(
    nodes: List[FlowNode], edges: List[FlowEdge]
) -> tuple[List[str], Dict[str, List[str]]]:
    node_ids = {node.id for node in nodes}
    indegree: Dict[str, int] = {node.id: 0 for node in nodes}
    outgoing: Dict[str, List[str]] = defaultdict(list)
    incoming: Dict[str, List[str]] = defaultdict(list)

    for edge in edges:
        if edge.source not in node_ids or edge.target not in node_ids:
            continue
        outgoing[edge.source].append(edge.target)
        incoming[edge.target].append(edge.source)
        indegree[edge.target] += 1

    queue = deque(sorted(node_id for node_id, degree in indegree.items() if degree == 0))
    order: List[str] = []

    while queue:
        current = queue.popleft()
        order.append(current)
        for child in outgoing.get(current, []):
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    if len(order) != len(node_ids):
        raise HTTPException(
            status_code=400,
            detail="Flow graph contains cycles or unresolved dependencies.",
        )

    return order, incoming


def _resolve_node_input(
    node_id: str,
    incoming: Mapping[str, List[str]],
    outputs_by_node: Mapping[str, Any],
    initial_input: Any,
) -> Any:
    parents = incoming.get(node_id, [])
    if not parents:
        return initial_input
    if len(parents) == 1:
        return outputs_by_node.get(parents[0])
    return [outputs_by_node.get(parent_id) for parent_id in parents]


async def _execute_node(tool_data: Mapping[str, Any], node_data: Mapping[str, Any], node_input: Any) -> Any:
    tool_name = str(tool_data.get("name") or node_data.get("label") or "").strip()
    normalized = tool_name.lower()
    config_raw = tool_data.get("config")
    config = config_raw if isinstance(config_raw, Mapping) else {}

    if normalized in ("task", "agent"):
        return {
            "tool": tool_name or "Node",
            "status": "ok",
            "input": node_input,
            "message": config.get("message") or f"{tool_name or 'Node'} executed.",
        }

    if normalized == "classifier":
        prompt = str(config.get("prompt") or "Classify this input into one concise label.")
        return await execute_classifier(node_input, prompt)

    if normalized == "summarizer":
        text = config.get("text", node_input)
        return await execute_summarizer(text)

    if normalized == "webhook":
        url = str(config.get("url") or "")
        payload = config.get("payload", node_input)
        return await execute_webhook(url, payload)

    if normalized == "slack action":
        webhook_url = str(config.get("webhook_url") or config.get("url") or "")
        default_message = (
            f"Plot Studio flow update: {_preview(node_input, max_length=160)}"
            if node_input is not None
            else "Plot Studio Slack Action executed."
        )
        message = str(config.get("message") or default_message)
        return await execute_slack_action(webhook_url, message)

    if normalized == "http request":
        method = str(config.get("method") or "GET")
        url = str(config.get("url") or "")
        headers = config.get("headers")
        body = config.get("body", node_input)
        headers_mapping = headers if isinstance(headers, Mapping) else {}
        return await execute_http_request(method, url, headers_mapping, body)

    if normalized == "data mapper":
        input_json = config.get("input_json", node_input)
        mapping_schema = config.get("mapping_schema") or config.get("mapping") or {}
        return await execute_data_mapper(input_json, mapping_schema)

    raise HTTPException(status_code=400, detail=f"Unsupported tool: {tool_name or 'unknown'}")


@router.post("/api/execute-flow", response_model=ExecuteFlowResponse)
async def execute_flow(
    req: ExecuteFlowRequest,
    current_user: str = Depends(get_current_user),
):
    if not req.nodes:
        raise HTTPException(status_code=400, detail="Flow must contain at least one node.")

    node_by_id = {node.id: node for node in req.nodes}
    execution_order, incoming = _topological_sort(req.nodes, req.edges)

    outputs_by_node: Dict[str, Any] = {}
    logs: List[Dict[str, Any]] = []

    for node_id in execution_order:
        node = node_by_id[node_id]
        node_data = node.data or {}
        tool_data_raw = node_data.get("toolData")
        tool_data = tool_data_raw if isinstance(tool_data_raw, Mapping) else {}

        node_name = str(tool_data.get("name") or node_data.get("label") or node_id)
        node_input = _resolve_node_input(node_id, incoming, outputs_by_node, req.initial_input)

        logs.append(
            {
                "node_id": node_id,
                "node_name": node_name,
                "status": "running",
                "message": "Executing node",
                "output_preview": _preview(node_input),
            }
        )

        try:
            output = await _execute_node(tool_data, node_data, node_input)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Execution failed for node '{node_name}': {exc}",
            ) from exc

        outputs_by_node[node_id] = output
        logs.append(
            {
                "node_id": node_id,
                "node_name": node_name,
                "status": "completed",
                "message": "Node execution completed",
                "output_preview": _preview(output),
            }
        )

    final_output = outputs_by_node[execution_order[-1]]
    return {
        "logs": logs,
        "outputs_by_node": outputs_by_node,
        "final_output": final_output,
        "execution_order": execution_order,
    }

