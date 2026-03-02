from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Mapping, Sequence

from fastapi import HTTPException

from backend.engine.tools import (
    execute_classifier,
    execute_data_mapper,
    execute_http_request,
    execute_slack_action,
    execute_summarizer,
    execute_webhook,
)

ExecutionLogCallback = Callable[[Dict[str, Any]], Awaitable[None] | None]


@dataclass
class FlowRunResult:
    logs: List[Dict[str, Any]]
    outputs_by_node: Dict[str, Any]
    final_output: Any
    execution_order: List[str]


def preview(value: Any, max_length: int = 220) -> str:
    text = str(value)
    if len(text) <= max_length:
        return text
    return f"{text[:max_length]}..."


def build_execution_plan(
    nodes: Sequence[Mapping[str, Any]],
    edges: Sequence[Mapping[str, Any]],
) -> tuple[List[List[str]], List[str], Dict[str, List[str]]]:
    node_ids = [str(node.get("id")) for node in nodes if node.get("id")]
    if not node_ids:
        raise HTTPException(status_code=400, detail="Flow must contain at least one node.")

    unique_ids = set(node_ids)
    indegree: Dict[str, int] = {node_id: 0 for node_id in unique_ids}
    outgoing: Dict[str, List[str]] = defaultdict(list)
    incoming: Dict[str, List[str]] = defaultdict(list)

    for edge in edges:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        if not source or not target or source not in unique_ids or target not in unique_ids:
            continue
        outgoing[source].append(target)
        incoming[target].append(source)
        indegree[target] += 1

    current_level = sorted(node_id for node_id, degree in indegree.items() if degree == 0)
    levels: List[List[str]] = []
    execution_order: List[str] = []

    while current_level:
        levels.append(current_level)
        execution_order.extend(current_level)
        next_level: List[str] = []

        for node_id in current_level:
            for child in outgoing.get(node_id, []):
                indegree[child] -= 1
                if indegree[child] == 0:
                    next_level.append(child)

        current_level = sorted(next_level)

    if len(execution_order) != len(unique_ids):
        raise HTTPException(
            status_code=400,
            detail="Flow graph contains cycles or unresolved dependencies.",
        )

    return levels, execution_order, incoming


def resolve_node_input(
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


async def execute_node(tool_data: Mapping[str, Any], node_data: Mapping[str, Any], node_input: Any) -> Any:
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
            f"Plot Studio flow update: {preview(node_input, max_length=160)}"
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


async def _emit(log: Dict[str, Any], on_log: ExecutionLogCallback | None) -> None:
    if on_log is None:
        return
    result = on_log(log)
    if asyncio.iscoroutine(result):
        await result


async def execute_flow_graph(
    nodes: Sequence[Mapping[str, Any]],
    edges: Sequence[Mapping[str, Any]],
    initial_input: Any = None,
    on_log: ExecutionLogCallback | None = None,
) -> FlowRunResult:
    levels, execution_order, incoming = build_execution_plan(nodes, edges)
    node_by_id = {str(node.get("id")): node for node in nodes}

    outputs_by_node: Dict[str, Any] = {}
    logs: List[Dict[str, Any]] = []

    async def run_single_node(node_id: str) -> None:
        node = node_by_id[node_id]
        node_data_raw = node.get("data")
        node_data = node_data_raw if isinstance(node_data_raw, Mapping) else {}
        tool_data_raw = node_data.get("toolData")
        tool_data = tool_data_raw if isinstance(tool_data_raw, Mapping) else {}

        node_name = str(tool_data.get("name") or node_data.get("label") or node_id)
        node_input = resolve_node_input(node_id, incoming, outputs_by_node, initial_input)

        start_log = {
            "node_id": node_id,
            "node_name": node_name,
            "status": "running",
            "message": "Executing node",
            "output_preview": preview(node_input),
        }
        logs.append(start_log)
        await _emit(start_log, on_log)

        try:
            output = await execute_node(tool_data, node_data, node_input)
        except HTTPException as exc:
            failed_log = {
                "node_id": node_id,
                "node_name": node_name,
                "status": "failed",
                "message": str(exc.detail),
                "output_preview": None,
            }
            logs.append(failed_log)
            await _emit(failed_log, on_log)
            raise
        except Exception as exc:  # pragma: no cover - safety net
            failed_log = {
                "node_id": node_id,
                "node_name": node_name,
                "status": "failed",
                "message": f"Execution failed: {exc}",
                "output_preview": None,
            }
            logs.append(failed_log)
            await _emit(failed_log, on_log)
            raise HTTPException(
                status_code=500,
                detail=f"Execution failed for node '{node_name}': {exc}",
            ) from exc

        outputs_by_node[node_id] = output
        completed_log = {
            "node_id": node_id,
            "node_name": node_name,
            "status": "completed",
            "message": "Node execution completed",
            "output_preview": preview(output),
        }
        logs.append(completed_log)
        await _emit(completed_log, on_log)

    for level in levels:
        await asyncio.gather(*(run_single_node(node_id) for node_id in level))

    final_output = outputs_by_node.get(execution_order[-1])
    return FlowRunResult(
        logs=logs,
        outputs_by_node=outputs_by_node,
        final_output=final_output,
        execution_order=execution_order,
    )
