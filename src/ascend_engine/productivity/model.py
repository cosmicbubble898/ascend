"""Pure interval accounting. Observations never imply cognitive attention."""

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

CATEGORIES = ("Work", "Communication", "Learning", "Personal", "Uncategorized")
DEFAULTS = {
    "code.exe": "Work",
    "devenv.exe": "Work",
    "windowsterminal.exe": "Work",
    "powershell.exe": "Work",
    "pwsh.exe": "Work",
    "excel.exe": "Work",
    "winword.exe": "Work",
    "powerpnt.exe": "Work",
    "figma.exe": "Work",
    "slack.exe": "Communication",
    "ms-teams.exe": "Communication",
    "teams.exe": "Communication",
    "outlook.exe": "Communication",
    "whatsapp.exe": "Communication",
    "telegram.exe": "Communication",
    "zoom.exe": "Communication",
}


@dataclass(frozen=True)
class Observation:
    app: str = ""
    title: str = ""
    monitor: str = ""
    idle: float = 0
    state: str = "active"
    context: str = "app_only"
    window: int = 0
    process: int = 0
    input_tick: int = 0
    event_generation: int = 0
    window_class: str = ""
    aumid: str = ""
    uia_domain: str = ""
    service: str = ""
    surface: str = "other"
    context_summary: str = ""
    context_confidence: int = 0
    context_source: str = "windows_metadata"
    audio_output: bool = False
    audio_input: bool = False
    media_title: str = ""


@dataclass
class Segment:
    start: int
    end: int
    app: str
    title: str
    monitor: str
    kind: str
    window_class: str = ""
    aumid: str = ""
    uia_domain: str = ""
    service: str = ""
    surface: str = "other"
    context_summary: str = ""
    context_confidence: int = 0
    context_source: str = "windows_metadata"
    audio_output: bool = False
    audio_input: bool = False
    media_title: str = ""


class Collector:
    """Coalesce samples for at most a minute, preserving uncertain gaps."""

    def __init__(self, watermark: int = 0) -> None:
        self.previous: tuple[int, float, Observation] | None = None
        self.pending: Segment | None = None
        self.watermark = watermark

    def flush(self) -> list[Segment]:
        rows = [self.pending] if self.pending else []
        self.pending = None
        return rows

    def reset(self) -> None:
        self.previous = None
        self.pending = None

    def _append(self, start: int, end: int, obs: Observation, kind: str) -> list[Segment]:
        start = max(start, self.watermark)
        if end <= start:
            return []
        self.watermark = end
        segment = Segment(
            start,
            end,
            obs.app if kind == "active" else "",
            obs.title if kind == "active" else "",
            obs.monitor,
            kind,
            obs.window_class if kind == "active" else "",
            obs.aumid if kind == "active" else "",
            obs.uia_domain if kind == "active" else "",
            obs.service if kind == "active" else "",
            obs.surface if kind == "active" else "other",
            obs.context_summary if kind == "active" else "",
            obs.context_confidence if kind == "active" else 0,
            obs.context_source if kind == "active" else "windows_metadata",
            obs.audio_output if kind == "active" else False,
            obs.audio_input if kind == "active" else False,
            obs.media_title if kind == "active" else "",
        )
        previous = self.pending
        if (
            previous
            and (
                previous.app,
                previous.title,
                previous.monitor,
                previous.kind,
                previous.uia_domain,
                previous.service,
                previous.audio_output,
                previous.audio_input,
            )
            == (
                segment.app,
                segment.title,
                segment.monitor,
                segment.kind,
                segment.uia_domain,
                segment.service,
                segment.audio_output,
                segment.audio_input,
            )
            and previous.end == start
            and end - previous.start <= 60000
        ):
            previous.end = end
            return []
        result = self.flush()
        self.pending = segment
        return result

    def tick(self, now: int, monotonic: float, obs: Observation) -> list[Segment]:
        previous = self.previous
        self.previous = (now, monotonic, obs)
        if previous is None:
            return []
        start, previous_mono, old = previous
        delta = monotonic - previous_mono
        if (
            delta <= 0
            or delta > 10
            or abs(now - start - delta * 1000) > 2000
            or obs.state != "active"
            or old.state != "active"
        ):
            return self.flush()
        if old.idle >= 300 and obs.idle < 300:
            return self._append(start, now, old, "idle")
        idle_at = now - int(max(0, obs.idle - 300) * 1000) if obs.idle >= 300 else now
        active_end = max(start, min(now, idle_at))
        rows = self._append(start, active_end, old, "active")
        rows += self._append(active_end, now, obs, "idle")
        return rows


def summarize(rows: list[dict[str, Any]], start: int, end: int) -> dict[str, Any]:
    apps: defaultdict[str, int] = defaultdict(int)
    categories: defaultdict[str, int] = defaultdict(int)
    active = 0
    idle = 0
    switches = 0
    focus = 0
    longest = 0
    run_start: int | None = None
    run_end = 0
    run_ms = 0
    run_app = ""
    last_app = ""
    last_end = 0
    hourly = [0] * 24
    for row in rows:
        began, ended = max(start, int(row["start"])), min(end, int(row["end"]))
        if ended <= began:
            continue
        duration = ended - began
        if row["kind"] == "active":
            active += duration
            app_name = str(row["app"])
            if app_name == "electron.exe" and str(row.get("title", "")).casefold().startswith(
                "ascend"
            ):
                app_name = "Ascend app"
            apps[app_name] += duration
            categories[str(row["category"])] += duration
            if last_app and last_app != row["app"] and began - last_end <= 3000:
                switches += 1
            last_app, last_end = str(row["app"]), ended
            cursor = began
            while cursor < ended:
                hour = min(23, (cursor - start) // 3600000)
                boundary = min(ended, start + (hour + 1) * 3600000)
                if boundary <= cursor:
                    boundary = ended
                hourly[hour] += boundary - cursor
                cursor = boundary
        else:
            idle += duration
            last_app = ""
        is_sustained = row["kind"] == "active"
        if run_start is not None and (
            not is_sustained or began - run_end > 3000 or str(row["app"]) != run_app
        ):
            length = run_ms
            longest = max(longest, length)
            focus += length if length >= 60000 else 0
            run_start = None
            run_ms = 0
            run_app = ""
        if is_sustained:
            if run_start is None:
                run_start = began
                run_app = str(row["app"])
            run_end = ended
            run_ms += duration
    if run_start is not None:
        length = run_ms
        longest = max(longest, length)
        focus += length if length >= 60000 else 0
    insights = []
    if active < 300000:
        insights.append(
            "A little more activity will make your patterns clearer. Start with one work session."
        )
    else:
        top = max(apps, key=lambda name: apps[name])
        insights.append(
            f"{top} accounts for {round(apps[top] / active * 100)}% of your tracked active time."
        )
        if categories["Uncategorized"] > active * 0.3:
            insights.append(
                "Categorize your main apps to make the work-session estimate more useful."
            )
        if longest >= 60000:
            insights.append(f"Your longest continuous active block was {longest // 60000} minutes.")
        elif switches > 10:
            insights.append(
                "Several app changes appeared between work blocks. Consider grouping related tasks; switching can also be part of your work."
            )
    return {
        "trackedMs": active,
        "idleMs": idle,
        "focusMs": focus,
        "longestMs": longest,
        "switches": switches,
        "hourly": hourly,
        "insights": insights,
        "apps": [
            {"name": key, "ms": val} for key, val in sorted(apps.items(), key=lambda pair: -pair[1])
        ],
        "categories": [{"name": key, "ms": val} for key, val in categories.items() if val],
    }
