"""Transparent reviews and candidate workflows from observed intervals only."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any

from ascend_engine.productivity.model import summarize


def habit_notes(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    grouped: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        cursor = row["start"]
        while cursor < row["end"]:
            date = datetime.fromtimestamp(cursor / 1000)
            midnight = date.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            boundary = min(row["end"], int(midnight.timestamp() * 1000))
            grouped[date.strftime("%Y-%m-%d")].append({**row, "start": cursor, "end": boundary})
            cursor = boundary
    observed = []
    for daily in grouped.values():
        value = summarize(daily, daily[0]["start"], daily[-1]["end"])
        if value["trackedMs"] >= 30 * 60000:
            observed.append(value)
    if len(observed) < 3:
        return []
    switching = sum(value["switches"] / (value["trackedMs"] / 3600000) >= 15 for value in observed)
    communication = sum(
        next((item["ms"] for item in value["categories"] if item["name"] == "Communication"), 0)
        > value["trackedMs"] * 0.4
        for value in observed
    )
    protected = sum(value["longestMs"] >= 20 * 60000 for value in observed)
    notes = []
    for count, title, description, action in [
        (
            switching,
            "Frequent switching is recurring",
            "15+ app changes per captured active hour",
            "Try one task block with related reference material prepared beforehand.",
        ),
        (
            communication,
            "Communication often takes a large share",
            "over 40% of captured active time in Communication",
            "Try batching one non-urgent message round when your responsibilities allow it.",
        ),
        (
            protected,
            "You are making room for longer work blocks",
            "at least one 20-minute Work/Learning block",
            "Protect a similar block for a task you care about.",
        ),
    ]:
        if count >= 3:
            notes.append(
                {
                    "title": title,
                    "evidence": f"{count} of {len(observed)} observed days had {description}. Each included day has at least 30 captured active minutes.",
                    "action": action,
                }
            )
    return notes


def workflow_action(sequence: tuple[str, ...]) -> str:
    labels = " ".join(sequence).casefold()
    if any(word in labels for word in ("whatsapp", "slack", "telegram", "teams")) and any(
        word in labels for word in ("clickup", "asana", "jira")
    ):
        return "Possible message-to-task handoff: if these visits turn messages into tickets, document the repeated steps and automate a reviewed draft. Keep the message source, project, and task description together."
    if any(word in labels for word in ("code.exe", "cursor", "github")):
        return "Possible repeated reference lookup: if you collect the same task details before editing, keep a reusable project note or local shortcut."
    return "If these visits repeat a copy, check, or update task, define its input and desired output once. Try a reusable template or local automation that prepares a draft for review."


def period_start(start: int, days: int) -> int:
    if days == 1:
        return start
    if start < days * 86400000:
        return 0
    return int((datetime.fromtimestamp(start / 1000) - timedelta(days=days - 1)).timestamp() * 1000)


def review(
    rows: list[dict[str, Any]],
    previous: list[dict[str, Any]],
    start: int,
    end: int,
    previous_start: int,
    goal: int,
) -> dict[str, Any]:
    totals = summarize(rows, start, end)
    earlier = summarize(previous, previous_start, start)
    planning: dict[str, int] = {"planned": 0, "unplanned": 0, "unspecified": 0}
    projects: defaultdict[str, int] = defaultdict(int)
    days: defaultdict[str, int] = defaultdict(int)
    runs: list[dict[str, Any]] = []
    for row in rows:
        if row["kind"] != "active":
            continue
        ms = row["end"] - row["start"]
        planning[row.get("planning", "unspecified")] += ms
        projects[row.get("project") or "Unassigned"] += ms
        cursor = row["start"]
        while cursor < row["end"]:
            date = datetime.fromtimestamp(cursor / 1000)
            next_day = date.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            boundary = min(row["end"], int(next_day.timestamp() * 1000))
            days[date.strftime("%Y-%m-%d")] += boundary - cursor
            cursor = boundary
        # Adjacent observations in the same app are one visit, never dozens of repetitions.
        label = row["app"]
        for name in ("whatsapp", "slack", "clickup", "asana", "github", "gmail"):
            if name in row.get("title", "").casefold():
                label = name
                break
        if runs and runs[-1]["label"] == label and row["start"] - runs[-1]["end"] <= 3000:
            runs[-1]["end"] = row["end"]
        else:
            runs.append({"label": label, "start": row["start"], "end": row["end"]})
    counts: Counter[tuple[str, ...]] = Counter()
    last_index: dict[tuple[str, ...], int] = {}
    for index in range(len(runs) - 2):
        trio = runs[index : index + 3]
        key = tuple(item["label"] for item in trio)
        if len(set(key)) < 2 or any(
            trio[i + 1]["start"] - trio[i]["end"] > 30000 for i in range(2)
        ):
            continue
        if trio[-1]["end"] - trio[0]["start"] > 15 * 60000 or index - last_index.get(key, -3) < 3:
            continue
        counts[key] += 1
        last_index[key] = index
    workflows = [
        {
            "sequence": list(key),
            "count": count,
            "evidence": f"This app sequence appeared {count} times in the selected period.",
            "action": workflow_action(key),
        }
        for key, count in counts.most_common(3)
        if count >= 3
    ]
    active = totals["trackedMs"]
    categories = {item["name"]: item["ms"] for item in totals["categories"]}
    coaching = {
        "title": "Build a useful baseline",
        "evidence": "At least 30 minutes of captured activity will support a first observation.",
        "action": "Use Ascend during an ordinary work session.",
    }
    if active >= 30 * 60000:
        if categories.get("Uncategorized", 0) > active * 0.3:
            coaching = {
                "title": "Make your day easier to understand",
                "evidence": f"{round(categories.get('Uncategorized', 0) / active * 100)}% of captured active time is Uncategorized.",
                "action": "Correct your most-used app or add a window-context rule.",
            }
        elif totals["switches"] / (active / 3600000) >= 15:
            coaching = {
                "title": "Try grouping related tasks",
                "evidence": f"{totals['switches']} app changes across {round(active / 60000)} captured active minutes. Switching may be part of your work.",
                "action": "Try one 25-minute session for a single task, then compare how it felt.",
            }
        elif categories.get("Communication", 0) > active * 0.4:
            coaching = {
                "title": "Explore a communication window",
                "evidence": f"{round(categories.get('Communication', 0) / active * 100)}% of captured active time is categorized as Communication.",
                "action": "Try batching one set of non-urgent messages, if your role allows it.",
            }
        else:
            coaching = {
                "title": "Protect a useful work block",
                "evidence": f"Your longest observed Work/Learning block was {totals['longestMs'] // 60000} minutes.",
                "action": "Plan a similar block for your next important task.",
            }
    calendar_days = []
    cursor = start
    while cursor < end:
        date = datetime.fromtimestamp(cursor / 1000)
        day_key = date.strftime("%Y-%m-%d")
        calendar_days.append(
            {"day": day_key, "ms": days.get(day_key, 0), "observed": day_key in days}
        )
        cursor = int((date + timedelta(days=1)).timestamp() * 1000)
    return {
        "activeMs": active,
        "focusMs": totals["focusMs"],
        "switches": totals["switches"],
        "previousActiveMs": earlier["trackedMs"],
        "previousFocusMs": earlier["focusMs"],
        "previousObserved": earlier["trackedMs"] > 0,
        "days": calendar_days,
        "planning": planning,
        "projects": [
            {"name": name, "ms": ms}
            for name, ms in sorted(projects.items(), key=lambda pair: -pair[1])
        ],
        "categories": totals["categories"],
        "coaching": coaching,
        "habits": habit_notes(rows),
        "workflows": workflows,
        "goalMinutes": goal,
        "goalProgress": min(
            100, round(totals["focusMs"] / max(1, goal * 60000 * len(calendar_days)) * 100)
        ),
    }
