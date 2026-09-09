"""Supervised local JSON-line service; stdin EOF stops capture and checkpoints."""

import json
import os
import queue
import re
import sys
import threading
import time
from contextlib import suppress
from dataclasses import replace
from pathlib import Path
from typing import Any, TextIO
from uuid import uuid4

from ascend_engine.productivity.audio_signals import foreground_audio_active, process_audio_signals
from ascend_engine.productivity.classification import classify
from ascend_engine.productivity.claude_activity import (
    MODEL as ACTIVITY_MODEL,
)
from ascend_engine.productivity.claude_activity import (
    analyze as analyze_activity,
)
from ascend_engine.productivity.claude_vision import MODEL, analyze
from ascend_engine.productivity.fusion import fuse
from ascend_engine.productivity.local_classifier import isolated_suggestion
from ascend_engine.productivity.model import CATEGORIES, Collector, Observation, summarize
from ascend_engine.productivity.reviews import period_start, review
from ascend_engine.productivity.screen_capture import capture_monitor
from ascend_engine.productivity.windows_capture import WindowsCapture
from ascend_engine.storage.productivity import ProductivityStore
from ascend_engine.storage.windows_protection import (
    anthropic_analysis_key_configured,
    anthropic_key_configured,
    load_anthropic_analysis_key,
    load_anthropic_key,
    local_vault_path,
)

VISION_INTERVAL_SECONDS = 60
ACTIVITY_ANALYSIS_INTERVAL_SECONDS = 60


def group_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row["app"],
            row["title"],
            row["category"],
            row["project"],
            row["kind"],
            row["monitor"],
            row["corrected"],
            row.get("task", ""),
            row.get("planning", "unspecified"),
            row.get("reason", ""),
            row.get("service", ""),
            row.get("surface", ""),
            row.get("contextConfidence", 0),
            row.get("audioOutput", False),
            row.get("audioInput", False),
        )
        if grouped and grouped[-1]["key"] == key and row["start"] == grouped[-1]["end"]:
            grouped[-1]["end"] = row["end"]
            grouped[-1]["live"] = grouped[-1]["live"] or row.get("live", False)
            if row["id"]:
                grouped[-1]["ids"].append(row["id"])
        else:
            grouped.append(
                {
                    **row,
                    "ids": [row["id"]] if row["id"] else [],
                    "key": key,
                    "live": row.get("live", False),
                }
            )
    for row in grouped:
        del row["key"]
    return grouped


class ProductivityService:
    def __init__(self, store: ProductivityStore) -> None:
        self.store = store
        self.collector = Collector(store.latest_end())
        self.capture = WindowsCapture()
        settings = store.settings()
        self.running = settings["pausedUntil"] <= int(time.time() * 1000)
        if self.running and settings["pausedUntil"]:
            store.set_setting("pausedUntil", 0)
        self.current = Observation(state="unavailable" if self.running else "paused")
        self.error = ""
        self.last_saved = 0
        self.checkpoint = time.monotonic()
        self.last_retention = time.monotonic()
        self.ai: dict[str, Any] = {"status": "idle"}
        self.ai_generation = 0
        self.ai_results: queue.Queue[tuple[int, dict[str, Any]]] = queue.Queue(maxsize=1)
        self.ai_thread: threading.Thread | None = None
        self.vision: dict[str, Any] = {"status": "idle", "model": MODEL}
        self.vision_results: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=1)
        self.vision_thread: threading.Thread | None = None
        self.pending_vision: dict[str, Any] | None = None
        self.pending_disposals: set[str] = set()
        self.vision_next = time.monotonic() + VISION_INTERVAL_SECONDS
        self.vision_input_tick = 0
        self.vision_event_generation = 0
        self.vision_baseline_set = False
        self.activity_analysis: dict[str, Any] = {"status": "idle", "model": ACTIVITY_MODEL}
        self.activity_results: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=1)
        self.activity_thread: threading.Thread | None = None
        self.activity_next = time.monotonic() + 15
        self.audio_checked = 0.0
        self.audio_process = 0
        self.audio_active = False
        self.audio_input = False
        self.event_generation = 0

    def event_pending(self) -> bool:
        return self.capture.event_pending(self.event_generation)

    def record(self, row: Any) -> None:
        identifier = self.store.add_segment(
            row.start,
            row.end,
            row.app,
            row.title,
            row.monitor,
            row.kind,
            {
                key: getattr(row, key)
                for key in (
                    "window_class",
                    "aumid",
                    "uia_domain",
                    "service",
                    "surface",
                    "context_summary",
                    "context_confidence",
                    "context_source",
                    "audio_output",
                    "audio_input",
                    "media_title",
                )
            },
        )
        focus = self.store.settings()["focus"]
        if (
            row.kind == "active"
            and focus.get("phase") == "focus"
            and focus.get("task")
            and row.start >= focus["started"]
        ):
            self.store.set_context(
                identifier, focus["project"], focus["task"], "planned", "Focus task you selected"
            )

    def flush(self) -> None:
        for row in self.collector.flush():
            self.record(row)
        self.store.save()
        self.last_saved = int(time.time() * 1000)
        self.checkpoint = time.monotonic()

    def tick(self) -> None:
        now = int(time.time() * 1000)
        settings = self.store.settings()
        if (
            not self.error
            and not self.running
            and settings["pausedUntil"]
            and now >= settings["pausedUntil"]
        ):
            self.store.set_setting("pausedUntil", 0)
            self.collector.reset()
            self.running = True
        focus = settings["focus"]
        if focus.get("phase") in ("focus", "break") and now >= focus["end"]:
            self.flush()
            self.collector.reset()
            self.store.set_setting(
                "focus", {**focus, "phase": "complete", "finishedPhase": focus["phase"]}
            )
            if focus["phase"] == "break":
                self.store.set_setting("breakAfter", now)
        try:
            generation, result = self.ai_results.get_nowait()
            if generation == self.ai_generation:
                self.ai = result
        except queue.Empty:
            pass
        try:
            activity_result = self.activity_results.get_nowait()
            if activity_result["status"] == "ready":
                self.store.add_activity_analysis(
                    activity_result["observed"],
                    activity_result["result"],
                    activity_result["latency"],
                )
                self.activity_analysis = {
                    "status": "ready",
                    "model": activity_result["result"]["model"],
                    "lastAnalysis": activity_result["observed"],
                    "labels": len(activity_result["result"]["items"]),
                }
            else:
                self.store.add_activity_analysis_error(
                    activity_result["observed"],
                    activity_result["error"],
                    activity_result["latency"],
                    activity_result.get("input_tokens", 0),
                    activity_result.get("output_tokens", 0),
                    activity_result.get("model", ACTIVITY_MODEL),
                )
                self.activity_analysis = {
                    "status": "error",
                    "model": ACTIVITY_MODEL,
                    "message": "Sonnet activity analysis was unavailable; tracking continued locally.",
                }
        except queue.Empty:
            pass
        try:
            for run_id in tuple(self.pending_disposals):
                try:
                    self.store.confirm_image_discarded(run_id, int(time.time() * 1000))
                except Exception:
                    continue
                self.pending_disposals.discard(run_id)
            vision_result = self.pending_vision or self.vision_results.get_nowait()
            vision_result.setdefault("run_id", f"run_{uuid4().hex}")
            vision_result.setdefault("evidence_id", f"evd_{uuid4().hex}")
            image = vision_result.get("image")
            try:
                if vision_result["status"] == "ready":
                    receipt = self.store.add_vision_result(
                        vision_result["observed"],
                        vision_result["app"],
                        vision_result["monitor"],
                        vision_result["result"],
                        vision_result["audio"],
                        vision_result["latency"],
                        vision_result["run_id"],
                        vision_result["evidence_id"],
                    )
                    self.vision = {
                        "status": "ready",
                        "model": vision_result["result"]["model"],
                        "lastAnalysis": vision_result["observed"],
                    }
                else:
                    receipt = self.store.add_vision_error(
                        vision_result["observed"],
                        vision_result["error"],
                        vision_result["latency"],
                        vision_result["captured"],
                        vision_result["run_id"],
                    )
                    self.vision = {
                        "status": "error",
                        "model": MODEL,
                        "message": "Vision analysis was unavailable; tracking continued locally.",
                    }
            except Exception:
                self.pending_vision = vision_result
                self.vision = {
                    "status": "error",
                    "model": MODEL,
                    "message": "Vision evidence is waiting for a confirmed local save; tracking continues.",
                }
            else:
                self.pending_vision = None
                if isinstance(image, bytearray) and image:
                    image[:] = b"\0" * len(image)
                    try:
                        self.store.confirm_image_discarded(receipt, int(time.time() * 1000))
                    except Exception:
                        self.pending_disposals.add(receipt)
                        self.vision = {
                            "status": "error",
                            "model": MODEL,
                            "message": "Vision evidence was saved, but its disposal receipt could not be updated.",
                        }
        except queue.Empty:
            pass
        if not self.running:
            return
        settings = self.store.settings()
        try:
            self.current = self.capture.sample(
                details=settings["details"],
                excluded=settings["excluded"],
                vision=settings["visionEnabled"],
            )
        except Exception:
            self.current = Observation(state="unavailable", event_generation=self.event_generation)
            now = int(time.time() * 1000)
            for row in self.collector.tick(now, time.monotonic(), self.current):
                self.record(row)
            return
        try:
            if self.current.state == "active":
                if (
                    self.current.process != self.audio_process
                    or time.monotonic() - self.audio_checked >= 10
                ):
                    audio = process_audio_signals(self.current.process, self.current.app)
                    self.audio_active = audio["output"]
                    self.audio_input = audio["input"]
                    self.audio_process = self.current.process
                    self.audio_checked = time.monotonic()
                self.current = replace(
                    self.current,
                    audio_output=self.audio_active,
                    audio_input=self.audio_input,
                )
                if self.current.idle >= 240 and (self.audio_active or self.audio_input):
                    self.current = replace(self.current, idle=0)
            else:
                self.audio_active = False
                self.audio_input = False
            self.event_generation = self.current.event_generation
            if self.current.state == "active" and not self.vision_baseline_set:
                self.vision_input_tick = self.current.input_tick
                self.vision_event_generation = self.current.event_generation
                self.vision_baseline_set = True
            now = int(time.time() * 1000)
            for row in self.collector.tick(now, time.monotonic(), self.current):
                self.record(row)
            if time.monotonic() - self.checkpoint >= 30:
                self.flush()
            if time.monotonic() - self.last_retention >= 3600:
                self.store.delete_range(0, max(1, now - 30 * 86400000))
                self.last_retention = time.monotonic()
            if time.monotonic() >= self.vision_next:
                self.vision_next = time.monotonic() + VISION_INTERVAL_SECONDS
                self._maybe_start_vision(now, settings)
            if time.monotonic() >= self.activity_next:
                self.activity_next = time.monotonic() + ACTIVITY_ANALYSIS_INTERVAL_SECONDS
                self._maybe_start_activity_analysis(now, settings)
        except Exception:
            self.running = False
            self.error = "storage_or_capture_failed"
            self.current = Observation(state="error")
            raise

    def _maybe_start_vision(self, observed: int, settings: dict[str, Any]) -> None:
        current = self.current
        local = time.localtime(observed / 1000)
        midnight = int(
            time.mktime((local.tm_year, local.tm_mon, local.tm_mday, 0, 0, 0, 0, 0, -1)) * 1000
        )
        usage = self.store.vision_usage(midnight, midnight + 86400000)
        eligible = (
            settings["visionEnabled"]
            and os.environ.get("ASCEND_DISABLE_CLOUD") != "1"
            and anthropic_key_configured()
            and current.state == "active"
            and current.idle < 300
            and bool(current.window)
            and current.context != "context_unavailable"
            and (
                current.input_tick != self.vision_input_tick
                or current.event_generation != self.vision_event_generation
            )
            and usage["requests"] < settings["visionDailyCap"]
            and not (self.vision_thread and self.vision_thread.is_alive())
        )
        if not eligible:
            return
        self.vision_input_tick = current.input_tick
        self.vision_event_generation = current.event_generation
        self.vision = {"status": "running", "model": MODEL}
        app, monitor, window, pid, title = (
            current.app,
            current.monitor,
            current.window,
            current.process,
            current.title,
        )

        def work() -> None:
            started = time.monotonic()
            image = bytearray()
            try:
                image = capture_monitor(window, monitor)
                audio = foreground_audio_active(pid)
                result = analyze(
                    image,
                    load_anthropic_key(),
                    {"app": app, "window_title": title, "audio_active": audio},
                )
                value = {
                    "status": "ready",
                    "observed": observed,
                    "app": app,
                    "monitor": monitor,
                    "audio": audio,
                    "result": result,
                    "latency": int((time.monotonic() - started) * 1000),
                    "captured": bool(image),
                    "image": image,
                }
            except Exception as exc:
                value = {
                    "status": "error",
                    "observed": observed,
                    "error": type(exc).__name__[:80],
                    "latency": int((time.monotonic() - started) * 1000),
                    "input_tokens": int(getattr(exc, "input_tokens", 0)),
                    "output_tokens": int(getattr(exc, "output_tokens", 0)),
                    "model": str(getattr(exc, "model", ACTIVITY_MODEL))[:100],
                    "captured": bool(image),
                    "image": image,
                }
            with suppress(queue.Full):
                self.vision_results.put_nowait(value)

        self.vision_thread = threading.Thread(target=work, daemon=True)
        self.vision_thread.start()

    def _maybe_start_activity_analysis(self, observed: int, settings: dict[str, Any]) -> None:
        if (
            not settings["activityAnalysisEnabled"]
            or os.environ.get("ASCEND_DISABLE_CLOUD") == "1"
            or not anthropic_analysis_key_configured()
            or (self.activity_thread and self.activity_thread.is_alive())
        ):
            return
        candidates = self.store.activity_analysis_candidates(observed - 86400000)
        if not candidates:
            return
        self.activity_analysis = {"status": "running", "model": ACTIVITY_MODEL}

        def work() -> None:
            started = time.monotonic()
            try:
                result = analyze_activity(candidates, load_anthropic_analysis_key())
                value = {
                    "status": "ready",
                    "observed": observed,
                    "result": result,
                    "latency": int((time.monotonic() - started) * 1000),
                }
            except Exception as exc:
                value = {
                    "status": "error",
                    "observed": observed,
                    "error": type(exc).__name__[:80],
                    "latency": int((time.monotonic() - started) * 1000),
                }
            with suppress(queue.Full):
                self.activity_results.put_nowait(value)

        self.activity_thread = threading.Thread(target=work, daemon=True)
        self.activity_thread.start()

    def snapshot(self, start: int, end: int, span: str = "day") -> dict[str, Any]:
        rows = self.store.rows(start, end)
        pending = self.collector.pending
        settings = self.store.settings()
        if pending and pending.end > start and pending.start < end:
            classified = classify(pending.app, pending.title, settings)
            signal_keys = (
                "window_class",
                "aumid",
                "uia_domain",
                "service",
                "surface",
                "context_summary",
                "context_confidence",
                "context_source",
                "audio_output",
                "audio_input",
                "media_title",
            )
            fused = fuse(classified, {key: getattr(pending, key) for key in signal_keys}, None)
            focus = settings["focus"]
            planned = (
                focus.get("phase") == "focus"
                and focus.get("task")
                and pending.start >= focus["started"]
            )
            rows.append(
                {
                    "id": "",
                    "start": max(start, pending.start),
                    "end": min(end, pending.end),
                    "app": pending.app,
                    "title": pending.title,
                    "monitor": pending.monitor,
                    "kind": pending.kind,
                    "category": fused["category"],
                    "reason": fused["reason"],
                    "project": focus["project"] if planned else fused["project"],
                    "task": focus["task"] if planned else fused["task"],
                    "planning": "planned" if planned else classified["planning"],
                    "corrected": False,
                    "live": True,
                    "service": fused["service"],
                    "surface": fused["surface"],
                    "visionSummary": fused["summary"],
                    "visionConfidence": 0,
                    "contextConfidence": fused["confidence"],
                    "domain": fused["domain"],
                    "audioActive": fused["audioOutput"] or fused["audioInput"],
                    "audioOutput": fused["audioOutput"],
                    "audioInput": fused["audioInput"],
                    "windowClass": pending.window_class,
                    "aumid": pending.aumid,
                    "evidenceSource": fused["evidenceSource"],
                }
            )
        grouped = group_rows(rows)
        days = 7 if span == "week" else 1
        review_start = period_start(start, days)
        previous_start = period_start(review_start, days + 1)
        report_rows = self.store.rows(review_start, end)
        if rows and rows[-1].get("live"):
            report_rows.append(rows[-1])
        report = review(
            report_rows,
            self.store.rows(previous_start, review_start),
            review_start,
            end,
            previous_start,
            settings["goalMinutes"],
        )
        now = int(time.time() * 1000)
        notices = []
        if settings["pausedUntil"] > now:
            notices.append(
                {
                    "id": f"pause:{settings['pausedUntil']}:{now // 1800000}",
                    "kind": "pause",
                    "title": "Ascend tracking is paused",
                    "body": "Your pause is still active. Open Ascend to see the countdown or resume now.",
                }
            )
        focus = settings["focus"]
        if focus.get("phase") == "complete" and focus["id"] != settings["notifiedFocus"]:
            notices.append(
                {
                    "id": focus["id"],
                    "kind": "focus",
                    "title": "Break complete"
                    if focus.get("finishedPhase") == "break"
                    else "Focus timer complete",
                    "body": "Open Ascend to review your session or choose what comes next.",
                }
            )
        stretch = 0
        last = now
        for row in reversed(
            self.store.rows(max(0, now - 4 * 3600000, settings["breakAfter"]), now)
        ):
            if row["kind"] != "active" or last - row["end"] > 60000:
                break
            stretch += row["end"] - row["start"]
            last = row["start"]
        if (
            self.running
            and settings["breakMinutes"]
            and stretch >= settings["breakMinutes"] * 60000
            and focus.get("phase") not in ("focus", "break")
        ):
            notices.append(
                {
                    "id": f"break:{now // 1800000}",
                    "kind": "break",
                    "title": "Room for a short break?",
                    "body": "You have a long stretch of captured activity. Open Ascend for a five-minute break.",
                }
            )
        return {
            "running": self.running,
            "error": self.error,
            "settings": settings,
            "pausedUntil": settings["pausedUntil"] if settings["pausedUntil"] > now else 0,
            "now": now,
            "focus": settings["focus"],
            "plans": self.store.plans(start, end),
            "report": report,
            "ai": self.ai,
            "vision": {
                **self.vision,
                "configured": os.environ.get("ASCEND_DISABLE_CLOUD") != "1"
                and anthropic_key_configured(),
                "enabled": settings["visionEnabled"],
                **self.store.vision_usage(start, end),
            },
            "visionLog": self.store.vision_log(),
            "activityAnalysis": {
                **self.activity_analysis,
                "configured": os.environ.get("ASCEND_DISABLE_CLOUD") != "1"
                and anthropic_analysis_key_configured(),
                "enabled": settings["activityAnalysisEnabled"],
            },
            "activityAnalysisLog": self.store.activity_analysis_log(),
            "notices": notices,
            "current": {
                "app": self.current.app,
                "title": self.current.title,
                "state": self.current.state,
                "context": self.current.context,
                "idle": self.current.idle >= 300,
                "audioActive": self.audio_active,
                "audioOutput": self.audio_active,
                "audioInput": self.audio_input,
                "windowClass": self.current.window_class,
                "aumid": self.current.aumid,
            },
            "lastSaved": self.last_saved,
            "summary": summarize(rows, start, end),
            "rows": list(reversed(grouped[-200:])),
            "totalRows": len(grouped),
            "storagePath": str(self.store.path),
            "categories": list(CATEGORIES),
        }

    def command(self, command: dict[str, Any]) -> dict[str, Any]:
        action = command.get("action")
        span = command.get("range", "day")
        start, end = command.get("start"), command.get("end")
        if (
            type(start) is not int
            or type(end) is not int
            or not (0 <= start < end <= 4102444800000)
            or end - start > 90000000
            or span not in ("day", "week")
        ):
            raise ValueError("invalid_period")
        if action == "state":
            return self.snapshot(start, end, span)
        if action == "start":
            self.flush()
            self.collector.reset()
            self.error = ""
            self.store.set_setting("pausedUntil", 0)
            self.running = True
            self.tick()
        elif action == "pause":
            hours = command.get("hours")
            if type(hours) is not int or hours not in (1, 4, 24, 48):
                raise ValueError("invalid_pause")
            self.running = False
            self.flush()
            self.collector.reset()
            self.store.set_setting("pausedUntil", int(time.time() * 1000) + hours * 3600000)
            self.store.set_setting("focus", {})
            self.current = Observation(state="paused")
        elif action == "settings":
            settings = command.get("settings")
            if not isinstance(settings, dict) or set(settings) != {
                "details",
                "excluded",
                "visionEnabled",
                "activityAnalysisEnabled",
            }:
                raise ValueError("invalid_settings")
            details, excluded = settings["details"], settings["excluded"]
            if (
                type(details) is not bool
                or type(settings["visionEnabled"]) is not bool
                or type(settings["activityAnalysisEnabled"]) is not bool
                or not isinstance(excluded, list)
                or len(excluded) > 100
            ):
                raise ValueError("invalid_settings")
            if any(
                not isinstance(item, str)
                or not re.fullmatch(r"[\w .()\-]{1,116}\.exe", item, re.ASCII)
                for item in excluded
            ):
                raise ValueError("invalid_exclusion")
            self.flush()
            self.collector.reset()
            self.store.set_setting("details", details)
            self.store.set_setting("excluded", sorted(set(item.lower() for item in excluded)))
            self.store.set_setting("visionEnabled", settings["visionEnabled"])
            self.store.set_setting("activityAnalysisEnabled", settings["activityAnalysisEnabled"])
        elif action == "correct":
            identifiers, category, project = (
                command.get("ids"),
                command.get("category"),
                command.get("project"),
            )
            if not isinstance(identifiers, list) or not 1 <= len(identifiers) <= 3000:
                raise ValueError("invalid_correction")
            if any(
                not isinstance(item, str) or not re.fullmatch(r"seg_[0-9a-f]{32}", item)
                for item in identifiers
            ):
                raise ValueError("invalid_correction")
            if (
                (category is not None and category not in CATEGORIES)
                or not isinstance(project, str)
                or len(project) > 100
            ):
                raise ValueError("invalid_correction")
            self.flush()
            task = command.get("task")
            planning = command.get("planning", "unspecified")
            if task is not None and (
                not isinstance(task, str)
                or len(task) > 100
                or planning not in ("planned", "unplanned", "unspecified")
            ):
                raise ValueError("invalid_context")
            self.store.correct_many(identifiers, category, project, task, planning)
        elif action == "rule":
            app, category = command.get("app"), command.get("category")
            if not isinstance(app, str) or not isinstance(category, str):
                raise ValueError("invalid_rule")
            self.store.set_rule(app, category)
        elif action == "delete_day":
            self.flush()
            self.collector.reset()
            self.store.delete_range(start, end)
            self.ai_generation += 1
            self.ai = {"status": "idle"}
        elif action == "preferences":
            goal, breaks, model = (
                command.get("goalMinutes"),
                command.get("breakMinutes"),
                command.get("aiModel"),
            )
            if (
                type(goal) is not int
                or not 10 <= goal <= 480
                or type(breaks) is not int
                or breaks not in (0, 30, 60, 90)
                or not isinstance(model, str)
                or (model and not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,100}", model))
                or "cloud" in model.casefold()
            ):
                raise ValueError("invalid_preferences")
            for key, value in [("goalMinutes", goal), ("breakMinutes", breaks), ("aiModel", model)]:
                self.store.set_setting(key, value)
        elif action == "profile":
            name, role, notes = command.get("name"), command.get("role"), command.get("notes")
            if not isinstance(name, str) or not isinstance(role, str) or not isinstance(notes, str):
                raise ValueError("invalid_profile")
            if len(name) > 80 or len(role) > 120 or len(notes) > 500:
                raise ValueError("invalid_profile")
            for key, value in (
                ("profileName", name.strip()),
                ("profileRole", role.strip()),
                ("profileNotes", notes.strip()),
            ):
                self.store.set_setting(key, value)
        elif action == "context_rule":
            keys = ("app", "pattern", "category", "project", "task", "planning")
            rule: dict[str, Any] = {key: command.get(key) for key in keys}
            if (
                any(not isinstance(value, str) for value in rule.values())
                or not re.fullmatch(r"[\w .()\-]{1,116}\.exe", rule["app"], re.ASCII)
                or not 3 <= len(rule["pattern"].strip()) <= 160
                or rule["category"] not in CATEGORIES
                or len(rule["project"]) > 100
                or len(rule["task"]) > 100
                or rule["planning"] not in ("planned", "unplanned", "unspecified")
            ):
                raise ValueError("invalid_context_rule")
            rules = self.store.settings()["contextRules"]
            rules = [
                item
                for item in rules
                if not (
                    item["app"] == rule["app"]
                    and item["pattern"].casefold() == rule["pattern"].casefold()
                )
            ]
            if len(rules) >= 25:
                raise ValueError("rule_limit")
            self.store.set_setting("contextRules", [*rules, {**rule, "id": uuid4().hex}])
        elif action == "remove_context_rule":
            identifier = command.get("ruleId")
            if not isinstance(identifier, str) or not re.fullmatch(r"[0-9a-f]{32}", identifier):
                raise ValueError("invalid_rule")
            self.store.set_setting(
                "contextRules",
                [
                    rule
                    for rule in self.store.settings()["contextRules"]
                    if rule["id"] != identifier
                ],
            )
        elif action == "save_plan":
            identifier = command.get("planId")
            if (
                not isinstance(identifier, str)
                or (identifier and not re.fullmatch(r"plan_[0-9a-f]{32}", identifier))
                or not isinstance(command.get("title"), str)
                or not isinstance(command.get("project"), str)
            ):
                raise ValueError("invalid_plan")
            self.store.save_plan(
                identifier,
                start,
                command["title"],
                command["project"],
                command["minutes"],
                command["completed"],
            )
        elif action == "delete_plan":
            identifier = command.get("planId")
            if not isinstance(identifier, str) or not re.fullmatch(
                r"plan_[0-9a-f]{32}", identifier
            ):
                raise ValueError("invalid_plan")
            self.store.delete_plan(identifier)
        elif action in ("focus_start", "break_start", "focus_cancel"):
            self.flush()
            self.collector.reset()
            if action == "focus_cancel":
                self.store.set_setting("focus", {})
            else:
                if not self.running:
                    raise ValueError("resume_tracking_first")
                minutes = 5 if action == "break_start" else command.get("minutes")
                if type(minutes) is not int or not 1 <= minutes <= 120:
                    raise ValueError("invalid_focus_duration")
                identifier = command.get("planId", "")
                plan = next(
                    (item for item in self.store.plans(start, end) if item["id"] == identifier),
                    None,
                )
                if identifier and not plan:
                    raise ValueError("unknown_plan")
                now = int(time.time() * 1000)
                self.store.set_setting(
                    "focus",
                    {
                        "id": uuid4().hex,
                        "phase": "break" if action == "break_start" else "focus",
                        "started": now,
                        "end": now + minutes * 60000,
                        "project": plan["project"] if plan else "",
                        "task": plan["title"] if plan else "",
                        "planId": identifier,
                    },
                )
        elif action == "notice_seen":
            identifier = command.get("noticeId")
            if not isinstance(identifier, str) or not re.fullmatch(r"[0-9a-f]{32}", identifier):
                raise ValueError("invalid_notice")
            self.store.set_setting("notifiedFocus", identifier)
        elif action == "ai_suggest":
            identifiers = command.get("ids")
            model = self.store.settings()["aiModel"]
            if (
                not model
                or not isinstance(identifiers, list)
                or not 1 <= len(identifiers) <= 3000
                or any(
                    not isinstance(item, str) or not re.fullmatch(r"seg_[0-9a-f]{32}", item)
                    for item in identifiers
                )
            ):
                raise ValueError("invalid_ai_request")
            if self.ai.get("status") == "running" or (self.ai_thread and self.ai_thread.is_alive()):
                raise ValueError("model_busy")
            selected = [row for row in self.store.rows(start, end) if row["id"] in identifiers]
            if len(selected) != len(set(identifiers)) or any(
                row["kind"] != "active"
                or (row["app"], row["title"]) != (selected[0]["app"], selected[0]["title"])
                for row in selected
            ):
                raise ValueError("invalid_ai_context")
            self.ai_generation += 1
            generation = self.ai_generation
            self.ai = {"status": "running", "ids": identifiers, "model": model}
            app_name, title = selected[0]["app"], selected[0]["title"]

            def classify_selected() -> None:
                try:
                    result = {
                        "status": "ready",
                        "ids": identifiers,
                        **isolated_suggestion(model, app_name, title),
                    }
                except Exception:
                    result = {
                        "status": "error",
                        "message": "Local model unavailable or response rejected. Check your installed Ollama model; no category was changed.",
                    }
                with suppress(queue.Full):
                    self.ai_results.put_nowait((generation, result))

            self.ai_thread = threading.Thread(target=classify_selected, daemon=True)
            self.ai_thread.start()
        elif action == "apply_ai":
            if self.ai.get("status") != "ready":
                raise ValueError("no_suggestion")
            self.store.correct_many(
                self.ai["ids"],
                self.ai["category"],
                command.get("project", ""),
                command.get("task", ""),
                command.get("planning", "unspecified"),
                f"Local AI suggestion accepted: {self.ai['model']}"[:160],
            )
            self.ai = {"status": "idle"}
        else:
            raise ValueError("invalid_action")
        return self.snapshot(start, end, span)


def _read_lines(stream: TextIO, messages: queue.Queue[str | None]) -> None:
    try:
        while True:
            line = stream.readline(256001)
            if not line or len(line) > 256000:
                break
            messages.put(line, timeout=2)
    finally:
        messages.put(None)


def run(path: Path | None = None) -> int:
    messages: queue.Queue[str | None] = queue.Queue(maxsize=64)
    threading.Thread(target=_read_lines, args=(sys.stdin, messages), daemon=True).start()
    try:
        with ProductivityStore(path or local_vault_path()) as store:
            service = ProductivityService(store)
            store.delete_range(0, max(1, int(time.time() * 1000) - 30 * 86400000))
            last_request = time.monotonic()
            next_tick = last_request
            while time.monotonic() - last_request < 35:
                fatal = False
                try:
                    line = messages.get(timeout=0.25)
                except queue.Empty:
                    line = ""
                if line is None:
                    break
                if line:
                    last_request = time.monotonic()
                    identifier = 0
                    try:
                        command = json.loads(line)
                        if not isinstance(command, dict) or type(command.get("id")) is not int:
                            raise ValueError("invalid_command")
                        identifier = command["id"]
                        state = service.command(command)
                        response = {"id": identifier, "state": state}
                    except ValueError:
                        response = {"id": identifier, "error": "invalid_request"}
                    except Exception:
                        service.running = False
                        service.error = "storage_or_capture_failed"
                        response = {"id": identifier, "error": "storage_or_capture_failed"}
                        fatal = True
                    print(json.dumps(response, ensure_ascii=True), flush=True)
                    if fatal:
                        break
                if time.monotonic() >= next_tick or service.event_pending():
                    try:
                        service.tick()
                    except Exception:
                        service.running = False
                        service.error = "storage_or_capture_failed"
                        service.current = Observation(state="error")
                        break
                    next_tick = time.monotonic() + 2
            service.running = False
            service.flush()
            service.capture.close()
    except Exception:
        print(json.dumps({"id": 0, "error": "local_storage_unavailable"}), flush=True)
        return 1
    return 0


if __name__ == "__main__":
    # A path is accepted only by the process launcher for an isolated QA profile,
    # never through the renderer's command protocol.
    raise SystemExit(run(Path(sys.argv[1]) if len(sys.argv) == 2 else None))
