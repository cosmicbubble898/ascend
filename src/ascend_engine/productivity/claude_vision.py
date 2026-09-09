"""Bounded Anthropic vision request with strict output validation."""

import base64
import http.client
import json
from typing import Any

MODEL = "claude-haiku-4-5-20251001"
SURFACES = {
    "document",
    "communication",
    "meeting",
    "development",
    "planning",
    "research",
    "media",
    "system",
    "other",
}
CATEGORIES = {"Work", "Communication", "Learning", "Personal", "Uncategorized"}
SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "service",
        "surface",
        "summary",
        "project_hint",
        "task_hint",
        "category_hint",
        "confidence",
    ],
    "properties": {
        "service": {"type": "string", "maxLength": 100},
        "surface": {"type": "string", "enum": sorted(SURFACES)},
        "summary": {"type": "string", "maxLength": 240},
        "project_hint": {"type": "string", "maxLength": 100},
        "task_hint": {"type": "string", "maxLength": 100},
        "category_hint": {"type": "string", "enum": sorted(CATEGORIES)},
        "confidence": {"type": "integer"},
    },
}


def analyze(png: bytearray, key: str, context: dict[str, Any]) -> dict[str, Any]:
    body = {
        "model": MODEL,
        "max_tokens": 220,
        "temperature": 0,
        "system": "Classify the visible work surface. Do not transcribe private content. Return concise metadata only.",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": base64.b64encode(png).decode("ascii"),
                        },
                    },
                    {"type": "text", "text": json.dumps(context, ensure_ascii=True)[:1200]},
                ],
            }
        ],
        "output_config": {"format": {"type": "json_schema", "schema": SCHEMA}},
    }
    connection = http.client.HTTPSConnection("api.anthropic.com", 443, timeout=30)
    connection.request(
        "POST",
        "/v1/messages",
        body=json.dumps(body),
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    response = connection.getresponse()
    data = response.read(1048577)
    connection.close()
    if response.status != 200 or len(data) > 1048576:
        raise OSError(f"anthropic_http_{response.status}")
    envelope = json.loads(data)
    value = json.loads(envelope["content"][0]["text"])
    if not isinstance(value, dict):
        raise ValueError("anthropic_response_invalid")
    if (
        set(value) != set(SCHEMA["required"])
        or value["surface"] not in SURFACES
        or value["category_hint"] not in CATEGORIES
        or type(value["confidence"]) is not int
        or not 0 <= value["confidence"] <= 1000
    ):
        raise ValueError("anthropic_response_invalid")
    for field, limit in (
        ("service", 100),
        ("summary", 240),
        ("project_hint", 100),
        ("task_hint", 100),
    ):
        if not isinstance(value[field], str):
            raise ValueError("anthropic_response_invalid")
        value[field] = value[field][:limit]
    if value["confidence"] <= 100:
        value["confidence"] *= 10
    usage = envelope.get("usage", {})
    value["input_tokens"] = int(usage.get("input_tokens", 0))
    value["output_tokens"] = int(usage.get("output_tokens", 0))
    value["model"] = str(envelope.get("model", MODEL))[:100]
    return dict(value)
