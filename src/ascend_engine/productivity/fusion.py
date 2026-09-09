"""Deterministic evidence fusion; model output remains a bounded hint."""

from typing import Any


def fuse(
    classified: dict[str, str],
    signals: dict[str, Any] | None,
    vision: dict[str, Any] | None,
    activity_analysis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    signals = signals or {}
    vision_data = vision or {}
    vision_confidence = int(vision_data.get("confidence") or 0)
    analysis_data = activity_analysis or {}
    analysis_confidence = int(analysis_data.get("confidence") or 0)
    if 0 < analysis_confidence <= 100:
        analysis_confidence *= 10
    adapter_confidence = int(signals.get("context_confidence") or 0)
    classification_reason = classified.get("reason", "")
    user_rule = classification_reason in ("Your context rule", "Your app rule")
    use_vision = bool(vision and vision_confidence >= 650 and adapter_confidence < 800)
    use_analysis = bool(activity_analysis and analysis_confidence >= 500 and not user_rule)
    use_adapter = adapter_confidence >= 600
    model_data = analysis_data if use_analysis else vision_data
    use_model = use_analysis or use_vision
    service = str(
        signals.get("service")
        if adapter_confidence >= 800
        else model_data.get("service")
        if use_model
        else signals.get("service") or ""
    )
    surface = str(
        signals.get("surface")
        if adapter_confidence >= 800
        else model_data.get("surface")
        if use_model
        else signals.get("surface") or "other"
    )
    summary = str(
        analysis_data.get("summary")
        if use_analysis
        else vision_data.get("summary")
        if use_vision
        else signals.get("context_summary") or ""
    )
    domain = str(signals.get("uia_domain") or vision_data.get("domain") or "")
    confidence = max(
        analysis_confidence if use_analysis else 0,
        vision_confidence if use_vision else 0,
        adapter_confidence,
    )
    sources = ["Windows metadata"]
    if classification_reason in (
        "Your context rule",
        "Your app rule",
        "Known app default",
        "Ascend app identity",
    ) or (classification_reason.startswith("Window-title match:")):
        sources.append(classification_reason)
    if signals.get("window_class") or signals.get("aumid"):
        sources.append("app identity")
    if signals.get("uia_domain"):
        sources.append("UI Automation")
    elif use_adapter:
        sources.append(
            {
                "window_title_adapter": "title adapter",
                "application_identity_adapter": "app adapter",
                "uia_domain_adapter": "UI Automation",
            }.get(str(signals.get("context_source") or ""), "local adapter")
        )
    if signals.get("audio_output") or signals.get("audio_input"):
        sources.append("audio session")
    if use_vision:
        sources.append("Claude vision")
    if use_analysis:
        sources.append("Claude Sonnet analysis")
    surface_category = {
        "communication": "Communication",
        "meeting": "Communication",
        "development": "Work",
        "planning": "Work",
        "document": "Work",
        "research": "Learning",
    }
    category = (
        classified["category"]
        if user_rule
        else str(analysis_data["category_hint"])
        if use_analysis
        else str(vision_data["category_hint"])
        if use_vision
        else surface_category.get(surface, classified["category"])
        if use_adapter
        else classified["category"]
    )
    if surface == "meeting" and (signals.get("audio_output") or signals.get("audio_input")):
        confidence = min(900, confidence + 100)
    if user_rule:
        confidence = 1000
    return {
        "category": category,
        "project": classified["project"]
        if user_rule and classified["project"]
        else analysis_data["project_hint"]
        if use_analysis and analysis_data.get("project_hint")
        else vision_data["project_hint"]
        if use_vision and vision_data.get("project_hint")
        else classified["project"],
        "task": classified["task"]
        if user_rule and classified["task"]
        else analysis_data["task_hint"]
        if use_analysis and analysis_data.get("task_hint")
        else vision_data["task_hint"]
        if use_vision and vision_data.get("task_hint")
        else classified["task"],
        "reason": " + ".join(sources),
        "service": service,
        "surface": surface,
        "summary": summary,
        "domain": domain,
        "confidence": confidence,
        "sources": sources,
        "audioOutput": bool(signals.get("audio_output")),
        "audioInput": bool(signals.get("audio_input")),
        "mediaTitle": str(signals.get("media_title") or ""),
        "evidenceSource": " + ".join(sources),
    }
