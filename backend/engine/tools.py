from __future__ import annotations

import json
import os
from typing import Any, Dict, Mapping

import httpx

DEFAULT_HTTP_TIMEOUT = httpx.Timeout(30.0)
DEFAULT_OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3")


def _coerce_json(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return ""
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return value
    return value


def _stringify(value: Any) -> str:
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return str(value)


def _extract_path(source: Any, path: str) -> Any:
    current: Any = source
    for part in path.split("."):
        if isinstance(current, Mapping):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit():
            index = int(part)
            if index >= len(current):
                return None
            current = current[index]
        else:
            return None
    return current


async def _call_ollama(user_prompt: str, system_prompt: str) -> str | None:
    body = {
        "model": DEFAULT_OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_HTTP_TIMEOUT) as client:
            response = await client.post(f"{DEFAULT_OLLAMA_BASE_URL}/api/chat", json=body)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    message = payload.get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    return None


async def execute_classifier(input_data: Any, prompt: str) -> Dict[str, Any]:
    input_text = _stringify(input_data)
    class_prompt = prompt.strip() if prompt else "Classify this text with one concise label."

    llm_response = await _call_ollama(
        user_prompt=f"{class_prompt}\n\nTEXT:\n{input_text}",
        system_prompt="You are a classification engine. Return only the final class label.",
    )

    if llm_response:
        return {
            "tool": "Classifier",
            "label": llm_response.splitlines()[0].strip(),
            "input": input_data,
            "source": "llm",
        }

    lowered = input_text.lower()
    if any(keyword in lowered for keyword in ["invoice", "payment", "refund", "billing"]):
        label = "billing"
    elif any(keyword in lowered for keyword in ["error", "bug", "exception", "stacktrace"]):
        label = "technical_issue"
    elif any(keyword in lowered for keyword in ["feature", "request", "enhancement"]):
        label = "feature_request"
    else:
        label = "general"

    return {
        "tool": "Classifier",
        "label": label,
        "input": input_data,
        "source": "fallback",
    }


async def execute_summarizer(text: Any) -> Dict[str, Any]:
    source_text = _stringify(text)

    llm_response = await _call_ollama(
        user_prompt=f"Summarize this in under 80 words:\n\n{source_text}",
        system_prompt="You are a concise summarization engine.",
    )
    if llm_response:
        return {"tool": "Summarizer", "summary": llm_response, "source": "llm"}

    fallback = source_text[:280]
    if len(source_text) > 280:
        fallback = f"{fallback}..."
    return {"tool": "Summarizer", "summary": fallback, "source": "fallback"}


async def execute_webhook(url: str, payload: Any) -> Dict[str, Any]:
    if not url:
        return {"tool": "Webhook", "status": "skipped", "reason": "missing_url"}

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_HTTP_TIMEOUT) as client:
            response = await client.post(url, json=_coerce_json(payload))
            return {
                "tool": "Webhook",
                "status": "ok",
                "status_code": response.status_code,
                "response_text": response.text[:500],
            }
    except Exception as exc:
        return {
            "tool": "Webhook",
            "status": "error",
            "error": str(exc),
        }


async def execute_slack_action(webhook_url: str, message: str) -> Dict[str, Any]:
    payload = {"text": message or "Plot Studio Slack Action executed."}
    result = await execute_webhook(webhook_url, payload)
    result["tool"] = "Slack Action"
    return result


async def execute_http_request(
    method: str,
    url: str,
    headers: Mapping[str, str] | None,
    body: Any,
) -> Dict[str, Any]:
    if not url:
        return {"tool": "HTTP Request", "status": "skipped", "reason": "missing_url"}

    normalized_method = (method or "GET").upper()
    normalized_headers = dict(headers or {})
    request_body = _coerce_json(body)

    request_kwargs: Dict[str, Any] = {"headers": normalized_headers}
    if isinstance(request_body, (dict, list)):
        request_kwargs["json"] = request_body
    elif request_body not in (None, ""):
        request_kwargs["content"] = _stringify(request_body)

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_HTTP_TIMEOUT) as client:
            response = await client.request(normalized_method, url, **request_kwargs)

            parsed_body: Any
            try:
                parsed_body = response.json()
            except Exception:
                parsed_body = response.text

            return {
                "tool": "HTTP Request",
                "status": "ok",
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": parsed_body,
            }
    except Exception as exc:
        return {
            "tool": "HTTP Request",
            "status": "error",
            "error": str(exc),
        }


async def execute_data_mapper(input_json: Any, mapping_schema: Any) -> Dict[str, Any]:
    input_value = _coerce_json(input_json)
    schema_value = _coerce_json(mapping_schema)
    if not isinstance(schema_value, Mapping):
        return {
            "tool": "Data Mapper",
            "status": "skipped",
            "reason": "invalid_mapping_schema",
            "mapped": {},
        }

    mapped: Dict[str, Any] = {}
    for target_key, source_path in schema_value.items():
        if not isinstance(source_path, str):
            mapped[target_key] = None
            continue
        mapped[target_key] = _extract_path(input_value, source_path)

    return {
        "tool": "Data Mapper",
        "status": "ok",
        "mapped": mapped,
    }

