from pathlib import Path

import pytest

from ascend_engine.productivity.accessibility import _domain
from ascend_engine.productivity.classification import classify
from ascend_engine.productivity.context_adapters import infer_context
from ascend_engine.productivity.fusion import fuse
from ascend_engine.productivity.model import Collector, Observation
from ascend_engine.productivity.service import VISION_INTERVAL_SECONDS, ProductivityService
from ascend_engine.productivity.windows_events import (
    EVENT_OBJECT_NAMECHANGE,
    EVENT_SYSTEM_FOREGROUND,
    relevant_window_event,
)
from ascend_engine.storage.productivity import ProductivityStore


def test_local_context_adapters_are_conservative() -> None:
    meet = infer_context("chrome.exe", "Weekly sync - Google Meet")
    assert (meet["service"], meet["surface"], meet["confidence"]) == (
        "Google Meet",
        "meeting",
        700,
    )
    browser_meet = infer_context("chrome.exe", "Meet - Jayant - Catch-Up - Google Chrome")
    assert (browser_meet["service"], browser_meet["surface"]) == ("Google Meet", "meeting")
    clickup = infer_context("chrome.exe", "Task", "app.clickup.com")
    assert clickup["service"] == "ClickUp"
    assert clickup["source"] == "uia_domain_adapter"
    assert infer_context("unknown.exe", "Private document")["confidence"] == 300


def test_ascend_electron_window_has_product_identity() -> None:
    context = infer_context("electron.exe", "Ascend — Tracking activity")
    assert (context["service"], context["surface"], context["confidence"]) == (
        "Ascend",
        "system",
        1000,
    )
    assert (
        classify(
            "electron.exe",
            "Ascend — Tracking activity",
            {"contextRules": [], "rules": {}},
        )["category"]
        == "Work"
    )


def test_domain_parser_returns_only_a_valid_host() -> None:
    assert _domain("https://app.clickup.com/123?q=private") == "app.clickup.com"
    assert _domain("meet.google.com/abc-defg-hij") == "meet.google.com"
    assert _domain("not a domain") == ""


def test_only_foreground_and_foreground_title_events_trigger_capture_activity() -> None:
    assert relevant_window_event(EVENT_SYSTEM_FOREGROUND, 20, 0, 10)
    assert relevant_window_event(EVENT_OBJECT_NAMECHANGE, 10, 0, 10)
    assert not relevant_window_event(EVENT_OBJECT_NAMECHANGE, 20, 0, 10)
    assert not relevant_window_event(EVENT_OBJECT_NAMECHANGE, 10, -4, 10)


def test_fusion_records_provenance_and_uses_high_confidence_vision() -> None:
    classified = {
        "category": "Uncategorized",
        "project": "",
        "task": "",
        "planning": "unspecified",
        "reason": "No rule",
    }
    signals = {
        "service": "Google Meet",
        "surface": "meeting",
        "context_confidence": 700,
        "context_summary": "Active in Google Meet",
        "context_source": "window_title_adapter",
        "audio_output": True,
        "audio_input": True,
        "window_class": "Chrome_WidgetWin_1",
    }
    vision = {
        "service": "Google Meet",
        "surface": "meeting",
        "summary": "Project review meeting",
        "project_hint": "Ascend",
        "task_hint": "Review",
        "category_hint": "Communication",
        "confidence": 900,
        "domain": "",
    }
    result = fuse(classified, signals, vision)
    assert result["project"] == "Ascend"
    assert result["audioInput"]
    assert result["confidence"] == 900
    assert result["evidenceSource"] == (
        "Windows metadata + app identity + title adapter + audio session + Claude vision"
    )


def test_user_rules_and_verified_domain_beat_conflicting_vision() -> None:
    rule = {
        "category": "Learning",
        "project": "Ascend",
        "task": "Research",
        "planning": "planned",
        "reason": "Your context rule",
    }
    signals = {
        "service": "ClickUp",
        "surface": "planning",
        "context_confidence": 850,
        "context_source": "uia_domain_adapter",
        "uia_domain": "app.clickup.com",
    }
    vision = {
        "service": "YouTube",
        "surface": "media",
        "summary": "Watching media",
        "project_hint": "Other",
        "task_hint": "Other",
        "category_hint": "Personal",
        "confidence": 950,
    }
    result = fuse(rule, signals, vision)
    assert (result["category"], result["project"], result["task"]) == (
        "Learning",
        "Ascend",
        "Research",
    )
    assert (result["service"], result["surface"], result["confidence"]) == (
        "ClickUp",
        "planning",
        1000,
    )
    assert "Claude vision" not in result["sources"]


def test_sonnet_reconciles_vision_and_metadata_but_verified_domain_controls_service() -> None:
    classified = {
        "category": "Uncategorized",
        "project": "",
        "task": "",
        "planning": "unspecified",
        "reason": "Not enough context",
    }
    signals = {
        "service": "ClickUp",
        "surface": "planning",
        "context_confidence": 850,
        "context_source": "uia_domain_adapter",
        "uia_domain": "app.clickup.com",
    }
    analysis = {
        "service": "Project tool",
        "surface": "planning",
        "summary": "Reviewing the Ascend backlog",
        "project_hint": "Ascend",
        "task_hint": "Backlog review",
        "category_hint": "Work",
        "confidence": 920,
    }
    result = fuse(classified, signals, None, analysis)
    assert result["service"] == "ClickUp"
    assert (result["category"], result["project"], result["task"]) == (
        "Work",
        "Ascend",
        "Backlog review",
    )
    assert "Claude Sonnet analysis" in result["sources"]


def test_collector_splits_when_audio_or_service_evidence_changes() -> None:
    collector = Collector()
    first = Observation(app="chrome.exe", title="Meet", service="Google Meet")
    second = Observation(app="chrome.exe", title="Meet", service="Google Meet", audio_input=True)
    collector.tick(1000, 1, first)
    rows = collector.tick(3000, 3, second)
    rows += collector.tick(5000, 5, second)
    rows += collector.flush()
    assert len(rows) == 2
    assert not rows[0].audio_input and rows[1].audio_input


def _vision_result() -> dict[str, object]:
    return {
        "service": "ClickUp",
        "surface": "planning",
        "summary": "Reviewing a task",
        "project_hint": "Ascend",
        "task_hint": "Audit",
        "category_hint": "Work",
        "confidence": 900,
        "model": "claude-haiku-4-5-20251001",
        "input_tokens": 100,
        "output_tokens": 20,
    }


def test_vision_receipt_retry_is_idempotent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        original = store.save
        attempts = 0

        def flaky_save() -> None:
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise OSError("synthetic_publish_failure")
            original()

        monkeypatch.setattr(store, "save", flaky_save)
        arguments = (5000, "chrome.exe", "DISPLAY1", _vision_result(), False, 200)
        run_id = "run_" + "a" * 32
        evidence_id = "evd_" + "b" * 32
        with pytest.raises(OSError, match="synthetic_publish_failure"):
            store.add_vision_result(*arguments, run_id, evidence_id)
        assert store.add_vision_result(*arguments, run_id, evidence_id) == run_id
        assert (
            store.connection.execute(
                "SELECT count(*) FROM screen_analysis_runs WHERE run_id=?", (run_id,)
            ).fetchone()[0]
            == 1
        )
        assert (
            store.connection.execute(
                "SELECT count(*) FROM activity_evidence WHERE evidence_id=?", (evidence_id,)
            ).fetchone()[0]
            == 1
        )


def test_service_erases_pixels_only_after_evidence_receipt(tmp_path: Path) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        service = ProductivityService(store)
        service.running = False
        image = bytearray(b"sensitive synthetic pixels")
        service.pending_vision = {
            "status": "ready",
            "observed": 5000,
            "app": "chrome.exe",
            "monitor": "DISPLAY1",
            "result": _vision_result(),
            "audio": False,
            "latency": 200,
            "image": image,
        }
        service.tick()
        service.capture.close()
        assert image == bytearray(len(image))
        entry = store.vision_log()["entries"][0]
        assert entry["evidenceCommitted"] == 1
        assert entry["imageDisposition"] == "discarded_after_commit"


def test_vision_evidence_applies_only_to_the_observed_segment_and_monitor(tmp_path: Path) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        store.add_segment(1000, 5000, "chrome.exe", "First", "DISPLAY1", "active")
        store.add_segment(5000, 9000, "chrome.exe", "Second", "DISPLAY1", "active")
        store.add_segment(5000, 9000, "chrome.exe", "Other monitor", "DISPLAY2", "active")
        store.add_vision_result(5000, "chrome.exe", "DISPLAY1", _vision_result(), False, 200)
        rows = store.rows(0, 10000)
        by_title = {row["title"]: row for row in rows}
        assert by_title["First"]["visionConfidence"] == 0
        assert by_title["Second"]["visionSummary"] == "Reviewing a task"
        assert by_title["Second"]["visionConfidence"] == 900
        assert by_title["Other monitor"]["visionConfidence"] == 0


def test_sonnet_activity_labels_are_segment_scoped_and_costed(tmp_path: Path) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        segment = store.add_segment(
            1000, 5000, "chrome.exe", "Ascend backlog", "DISPLAY1", "active"
        )
        candidates = store.activity_analysis_candidates(0)
        assert [row["id"] for row in candidates] == [segment]
        store.add_activity_analysis(
            6000,
            {
                "items": [
                    {
                        "id": segment,
                        "service": "ClickUp",
                        "surface": "planning",
                        "summary": "Reviewing the Ascend backlog",
                        "project_hint": "Ascend",
                        "task_hint": "Backlog review",
                        "category_hint": "Work",
                        "confidence": 930,
                    }
                ],
                "input_tokens": 500,
                "output_tokens": 100,
                "model": "claude-sonnet-5",
            },
            250,
        )
        row = store.rows(0, 10000)[0]
        assert (row["category"], row["project"], row["analysisConfidence"]) == (
            "Work",
            "Ascend",
            930,
        )
        assert "Claude Sonnet analysis" in row["evidenceSource"]
        assert store.activity_analysis_log() == {
            "attempts": 1,
            "successful": 1,
            "failed": 0,
            "labels": 1,
            "inputTokens": 500,
            "outputTokens": 100,
            "estimatedUsd": 0.002,
            "entries": [
                {
                    "observedAt": 6000,
                    "status": "success",
                    "model": "claude-sonnet-5",
                    "latencyMs": 250,
                    "inputTokens": 500,
                    "outputTokens": 100,
                    "errorCode": "",
                    "labels": 1,
                }
            ],
        }


def test_first_sample_establishes_vision_activity_baseline(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        service = ProductivityService(store)
        sample = Observation(
            app="chrome.exe",
            monitor="DISPLAY1",
            state="active",
            context="windows_accessibility",
            window=1,
            process=1,
            input_tick=100,
            event_generation=3,
        )
        monkeypatch.setattr(service.capture, "sample", lambda **_kwargs: sample)
        monkeypatch.setattr(
            "ascend_engine.productivity.service.anthropic_key_configured", lambda: True
        )
        service.vision_next = 0
        service.tick()
        service.capture.close()
        assert service.vision_baseline_set
        assert service.vision["status"] == "idle"


def test_vision_interval_is_one_minute() -> None:
    assert VISION_INTERVAL_SECONDS == 60


def test_transient_windows_capture_failure_does_not_stop_tracking(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        service = ProductivityService(store)

        def unavailable(**_kwargs: object) -> Observation:
            raise OSError("synthetic_capture_failure")

        monkeypatch.setattr(service.capture, "sample", unavailable)
        service.tick()
        service.capture.close()
        assert service.running
        assert service.error == ""
        assert service.current.state == "unavailable"
