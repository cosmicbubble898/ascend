"""Explainable app/title rules. No web history, body text, or inference calls."""

from typing import Any

from ascend_engine.productivity.model import DEFAULTS

APP_CATEGORIES = {
    **DEFAULTS,
    "codex.exe": "Work",
    "notion.exe": "Work",
    "obsidian.exe": "Work",
    "clickup.exe": "Work",
    "asana.exe": "Work",
    "pycharm64.exe": "Work",
    "cursor.exe": "Work",
    "acrobat.exe": "Work",
    "spotify.exe": "Personal",
    "vlc.exe": "Personal",
}
CONTEXTS = [
    ("Communication", ("whatsapp", "slack", "microsoft teams", "gmail", "outlook")),
    (
        "Work",
        (
            "clickup",
            "asana",
            "github",
            "gitlab",
            "jira",
            "linear",
            "figma",
            "google docs",
            "google sheets",
        ),
    ),
    ("Learning", ("documentation", "stack overflow", "coursera", "udemy", "tutorial")),
    ("Personal", ("netflix", "instagram", "facebook", "prime video")),
]


def classify(app: str, title: str, settings: dict[str, Any]) -> dict[str, str]:
    result = {
        "category": "Uncategorized",
        "reason": "Not enough context",
        "project": "",
        "task": "",
        "planning": "unspecified",
    }
    folded = title.casefold()
    if app == "electron.exe" and folded.startswith("ascend"):
        return {**result, "category": "Work", "reason": "Ascend app identity"}
    for rule in reversed(settings.get("contextRules", [])):
        if rule["app"] == app and rule["pattern"].casefold() in folded:
            return {
                **result,
                **{key: rule[key] for key in ("category", "project", "task", "planning")},
                "reason": "Your context rule",
            }
    if app in settings["rules"]:
        return {**result, "category": settings["rules"][app], "reason": "Your app rule"}
    if title:
        import re

        for category, terms in CONTEXTS:
            for term in terms:
                if re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", folded):
                    return {**result, "category": category, "reason": f"Window-title match: {term}"}
    if app in APP_CATEGORIES:
        return {**result, "category": APP_CATEGORIES[app], "reason": "Known app default"}
    return result
