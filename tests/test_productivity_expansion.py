"""Behavioral regression checks for the personal productivity expansion."""

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from typing import Any, TypedDict

import pytest

from ascend_engine.productivity import local_classifier
from ascend_engine.productivity.classification import classify
from ascend_engine.productivity.model import Observation, Segment
from ascend_engine.productivity.reviews import habit_notes, review
from ascend_engine.productivity.service import ProductivityService
from ascend_engine.storage import migration_runner
from ascend_engine.storage.productivity import ProductivityStore


def test_tracking_defaults_on_and_timed_pause_survives_restart(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    now = [1800000000.0]
    monkeypatch.setattr("ascend_engine.productivity.service.time.time", lambda: now[0])
    monkeypatch.setattr(
        "ascend_engine.productivity.windows_capture.WindowsCapture.sample",
        lambda *_args, **_kwargs: Observation(state="unavailable"),
    )
    period = {"start": 0, "end": 86400000}
    vault = tmp_path / "activity.vault"
    with ProductivityStore(vault) as store:
        service = ProductivityService(store)
        assert service.running
        state = service.command({"action": "pause", "hours": 1, **period})
        assert not state["running"]
        assert state["pausedUntil"] == int((now[0] + 3600) * 1000)
    with ProductivityStore(vault) as store:
        service = ProductivityService(store)
        assert not service.running
        now[0] += 3601
        service.tick()
        assert service.running
        assert store.settings()["pausedUntil"] == 0


@pytest.fixture
def workspace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[tuple[ProductivityService, list[float]]]:
    now = [1800000000.0]
    monkeypatch.setattr("ascend_engine.productivity.service.time.time", lambda: now[0])
    monkeypatch.setattr(
        "ascend_engine.productivity.windows_capture.WindowsCapture.sample",
        lambda *_args, **_kwargs: Observation(state="unavailable"),
    )
    with ProductivityStore(tmp_path / "activity.vault") as store:
        yield ProductivityService(store), now


class Period(TypedDict):
    start: int
    end: int


def day(now: float) -> Period:
    start = int(
        datetime.fromtimestamp(now).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        * 1000
    )
    return {"start": start, "end": start + 86400000}


@pytest.mark.parametrize("hours", [None, 0, 2, -1, True, "4", 49])
def test_pause_requires_one_of_the_supported_durations(
    workspace: tuple[ProductivityService, list[float]], hours: Any
) -> None:
    service, now = workspace
    with pytest.raises(ValueError, match="invalid_pause"):
        service.command({"action": "pause", "hours": hours, **day(now[0])})
    assert service.running
    assert service.store.settings()["pausedUntil"] == 0


def test_pause_reminder_buckets_and_early_resume(
    workspace: tuple[ProductivityService, list[float]],
) -> None:
    service, now = workspace
    period = day(now[0])
    first = service.command({"action": "pause", "hours": 48, **period})
    assert first["notices"][0]["id"] == service.snapshot(**period)["notices"][0]["id"]
    now[0] += 1801
    assert first["notices"][0]["id"] != service.snapshot(**period)["notices"][0]["id"]
    assert service.command({"action": "start", **period})["pausedUntil"] == 0


def test_context_rules_and_manual_correction_precedence(
    workspace: tuple[ProductivityService, list[float]],
) -> None:
    service, now = workspace
    period = day(now[0])
    store = service.store
    record = store.add_segment(
        period["start"],
        period["start"] + 60000,
        "msedge.exe",
        "GitHub - Ascend",
        "Synthetic",
        "active",
    )
    assert store.rows(**period)[0]["category"] == "Work"
    service.command(
        {
            "action": "context_rule",
            "app": "msedge.exe",
            "pattern": "Ascend",
            "category": "Learning",
            "project": "Ascend",
            "task": "Study",
            "planning": "planned",
            **period,
        }
    )
    store.set_rule("msedge.exe", "Personal")
    assert store.rows(**period)[0]["category"] == "Learning"
    store.correct_many([record], "Communication", "Different", "Discuss", "unplanned")
    assert store.rows(**period)[0]["planning"] == "unplanned"
    assert store.rows(**period)[0]["reason"] == "Manual correction"
    store.correct_many([record], None, "")
    assert store.rows(**period)[0]["project"] == "Ascend"
    assert classify("msedge.exe", "mygithubclone", store.settings())["reason"] == "Your app rule"


def test_focus_task_context_completion_and_notice_ack(
    workspace: tuple[ProductivityService, list[float]],
) -> None:
    service, now = workspace
    period = day(now[0])
    service.command(
        {
            "action": "save_plan",
            "planId": "",
            "title": "Draft proposal",
            "project": "Ascend",
            "minutes": 25,
            "completed": False,
            **period,
        }
    )
    plan = service.store.plans(**period)[0]
    result = service.command(
        {"action": "focus_start", "minutes": 25, "planId": plan["id"], **period}
    )
    began = int(now[0] * 1000)
    service.record(Segment(began, began + 10000, "code.exe", "", "Synthetic", "active"))
    assert service.store.rows(**period)[0]["task"] == "Draft proposal"
    assert service.store.rows(**period)[0]["planning"] == "planned"
    now[0] += 1501
    service.tick()
    state = service.snapshot(**period)
    assert state["focus"]["phase"] == "complete"
    assert state["notices"][0]["id"] == result["focus"]["id"]
    service.command({"action": "notice_seen", "noticeId": result["focus"]["id"], **period})
    assert not service.snapshot(**period)["notices"]
    assert not ProductivityService(service.store).snapshot(**period)["notices"]


def test_plans_and_context_are_scoped_and_survive_split_deletion(
    workspace: tuple[ProductivityService, list[float]],
) -> None:
    service, now = workspace
    store = service.store
    period = day(now[0])
    record = store.add_segment(
        period["start"], period["start"] + 60000, "code.exe", "", "Synthetic", "active"
    )
    store.correct_many([record], "Work", "Project", "Task", "planned")
    store.save_plan("", period["start"], "Plan", "Project", 25, False)
    original = store.scope
    store.scope = ("act_other", original[1], original[2], original[3])
    assert store.plans(**period) == []
    with pytest.raises(ValueError, match="unknown_record"):
        store.set_context(record, "", "", "unplanned", "Manual")
    store.scope = original
    store.delete_range(period["start"] + 10000, period["start"] + 20000)
    rows = store.rows(**period)
    assert len(rows) == 2
    assert all(row["task"] == "Task" and row["planning"] == "planned" for row in rows)
    assert sum(row["end"] - row["start"] for row in rows) == 50000


def test_review_uses_observed_time_and_repeated_visits_not_sample_count() -> None:
    start = 1800000000000
    rows = [
        {
            "id": str(i),
            "start": start + i * 60000,
            "end": start + (i + 1) * 60000,
            "app": ("a.exe", "b.exe", "c.exe")[i % 3],
            "title": "",
            "category": "Work",
            "kind": "active",
            "planning": "unspecified",
            "project": "",
        }
        for i in range(9)
    ]
    result = review(rows, [], start, start + 86400000, start - 86400000, 120)
    assert result["activeMs"] == 9 * 60000
    assert result["planning"]["unspecified"] == result["activeMs"]
    assert result["workflows"][0]["count"] == 3
    assert not result["previousObserved"]
    assert not review(
        [{**row, "app": "a.exe"} for row in rows],
        [],
        start,
        start + 86400000,
        start - 86400000,
        120,
    )["workflows"]


def test_local_ai_rejects_remote_and_malformed_results(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []

    def remote(endpoint: str, _payload: dict[str, Any]) -> dict[str, Any]:
        calls.append(endpoint)
        return {"remote_host": "https://example.invalid", "model_info": {"size": 1}}

    monkeypatch.setattr(local_classifier, "post", remote)
    with pytest.raises(ValueError, match="local_model_required"):
        local_classifier.suggest("local-test", "msedge.exe", "Synthetic")
    assert calls == ["/api/show"]

    def malformed(endpoint: str, _payload: dict[str, Any]) -> dict[str, Any]:
        return (
            {"model_info": {"size": 1}}
            if endpoint == "/api/show"
            else {"message": {"content": '{"category":"Execute code","reason":"bad"}'}}
        )

    monkeypatch.setattr(local_classifier, "post", malformed)
    with pytest.raises(ValueError, match="invalid_model_response"):
        local_classifier.suggest("local-test", "msedge.exe", "Synthetic")


def test_ai_suggestion_requires_apply_and_only_receives_selected_metadata(
    workspace: tuple[ProductivityService, list[float]], monkeypatch: pytest.MonkeyPatch
) -> None:
    service, now = workspace
    period = day(now[0])
    calls = []

    def fake(model: str, app: str, title: str) -> dict[str, str]:
        calls.append((model, app, title))
        return {"category": "Learning", "reason": "A documentation title", "model": model}

    monkeypatch.setattr("ascend_engine.productivity.service.isolated_suggestion", fake)
    service.store.set_setting("aiModel", "synthetic-local")
    record = service.store.add_segment(
        period["start"],
        period["start"] + 60000,
        "msedge.exe",
        "Synthetic documentation",
        "Synthetic",
        "active",
    )
    service.command({"action": "ai_suggest", "ids": [record], **period})
    assert service.ai_thread is not None
    service.ai_thread.join(timeout=2)
    service.tick()
    assert service.ai["status"] == "ready"
    assert not service.store.rows(**period)[0]["corrected"]
    assert calls == [("synthetic-local", "msedge.exe", "Synthetic documentation")]
    service.command(
        {"action": "apply_ai", "project": "", "task": "", "planning": "unspecified", **period}
    )
    assert service.store.rows(**period)[0]["reason"].startswith("Local AI suggestion accepted")


def test_encrypted_v2_history_upgrades_without_replacing_identity(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    real = migration_runner._bundle_root()
    for name in ("0001_foundation.sql", "0002_productivity.sql"):
        (bundle / name).write_bytes(real.joinpath(name).read_bytes())
    vault = tmp_path / "upgrade.vault"
    with monkeypatch.context() as context:
        context.setattr(migration_runner, "_bundle_root", lambda: bundle)
        with ProductivityStore(vault) as old:
            record = old.add_segment(
                1000, 2000, "code.exe", "Encrypted upgrade canary", "Synthetic", "active"
            )
            old.correct(record, "Learning", "Existing project")
            identity = old.scope
            old.save()
    with ProductivityStore(vault) as upgraded:
        assert upgraded.scope == identity
        assert upgraded.rows(0, 3000)[0]["project"] == "Existing project"
        assert upgraded.connection.execute("PRAGMA user_version").fetchone()[0] == 8
        upgraded.save()
    assert b"Encrypted upgrade canary" not in vault.read_bytes()


def test_habits_require_recurrence_across_three_observed_days() -> None:
    start = 1800000000000
    rows: list[dict[str, Any]] = []
    for offset in range(3):
        for minute in range(40):
            rows.append(
                {
                    "id": str(len(rows)),
                    "start": start + offset * 86400000 + minute * 60000,
                    "end": start + offset * 86400000 + (minute + 1) * 60000,
                    "app": "slack.exe",
                    "kind": "active",
                    "category": "Communication",
                }
            )
    assert habit_notes(rows[:80]) == []
    notes = habit_notes(rows)
    assert len(notes) == 2
    assert "3 of 3 observed days" in notes[0]["evidence"]


def test_midnight_samples_do_not_create_false_observed_days() -> None:
    start = day(1800000000)["start"]
    rows: list[dict[str, Any]] = []
    for offset in range(3):
        began = start + (offset + 1) * 86400000 - 29 * 60000 - 1000
        for minute in range(30):
            rows.append(
                {
                    "id": str(len(rows)),
                    "start": began + minute * 60000,
                    "end": began + (minute + 1) * 60000,
                    "app": "code.exe",
                    "kind": "active",
                    "category": "Work",
                }
            )
    assert habit_notes(rows) == []
