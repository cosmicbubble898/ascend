"""Bounded local adapters for app, title, and UI Automation metadata."""

import re
from typing import Any

BROWSERS = {"chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"}
SERVICES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("Google Meet", ("meet.google", "google meet"), "meeting"),
    ("Microsoft Teams", ("teams.microsoft", "microsoft teams"), "meeting"),
    ("Zoom", ("zoom meeting", "zoom workplace"), "meeting"),
    ("Slack", ("slack",), "communication"),
    ("WhatsApp", ("whatsapp",), "communication"),
    ("Gmail", ("gmail", "isha mail"), "communication"),
    ("ClickUp", ("clickup",), "planning"),
    ("Asana", ("asana",), "planning"),
    ("GitHub", ("github",), "development"),
    ("Google Docs", ("google docs",), "document"),
    ("Google Sheets", ("google sheets",), "document"),
    ("YouTube", ("youtube",), "media"),
)
APP_SERVICES = {
    "code.exe": ("Visual Studio Code", "development"),
    "cursor.exe": ("Cursor", "development"),
    "winword.exe": ("Microsoft Word", "document"),
    "excel.exe": ("Microsoft Excel", "document"),
    "powerpnt.exe": ("Microsoft PowerPoint", "document"),
    "slack.exe": ("Slack", "communication"),
    "whatsapp.exe": ("WhatsApp", "communication"),
    "zoom.exe": ("Zoom", "meeting"),
    "ms-teams.exe": ("Microsoft Teams", "meeting"),
}


def infer_context(app: str, title: str, domain: str = "") -> dict[str, Any]:
    """Return conservative semantic hints with explicit provenance."""
    if app == "electron.exe" and title.casefold().startswith("ascend"):
        return {
            "service": "Ascend",
            "surface": "system",
            "domain": domain,
            "summary": "Using the Ascend app",
            "confidence": 1000,
            "source": "application_identity_adapter",
        }
    folded = f"{domain} {title}".casefold()
    if app in BROWSERS and title.casefold().startswith("meet - "):
        return {
            "service": "Google Meet",
            "surface": "meeting",
            "domain": domain,
            "summary": "Active in Google Meet",
            "confidence": 700,
            "source": "window_title_adapter",
        }
    for service, markers, surface in SERVICES:
        if any(re.search(r"(?<!\w)" + re.escape(marker) + r"(?!\w)", folded) for marker in markers):
            source = "uia_domain_adapter" if domain else "window_title_adapter"
            return {
                "service": service,
                "surface": surface,
                "domain": domain,
                "summary": f"Active in {service}",
                "confidence": 850 if domain else 700,
                "source": source,
            }
    if app in APP_SERVICES:
        service, surface = APP_SERVICES[app]
        return {
            "service": service,
            "surface": surface,
            "domain": domain,
            "summary": f"Active in {service}",
            "confidence": 600,
            "source": "application_identity_adapter",
        }
    return {
        "service": "",
        "surface": "other",
        "domain": domain,
        "summary": "App activity captured",
        "confidence": 300 if app else 0,
        "source": "windows_metadata",
    }
