"""Behavioral checks for private local activity capture and correction."""

from pathlib import Path

import pytest

from ascend_engine.productivity.model import Collector, Observation, summarize
from ascend_engine.storage.productivity import ProductivityStore


def observed(app: str = "code.exe", *, idle: float = 0, state: str = "active") -> Observation:
    return Observation(
        app=app, title="Synthetic window", monitor="display-1", idle=idle, state=state
    )


def test_collector_counts_once_and_does_not_fill_sleep_or_paused_gaps() -> None:
    collector = Collector()
    collector.tick(1000, 1, observed())
    rows = collector.tick(3000, 3, observed())
    rows += collector.tick(5000, 5, observed("slack.exe"))
    rows += collector.tick(65000, 65, observed("slack.exe"))
    rows += collector.flush()
    assert sum(row.end - row.start for row in rows) == 4000
    assert rows[0].app == "code.exe"
    collector.reset()
    assert collector.tick(70000, 70, observed()) == []


def test_idle_lock_and_exclusion_do_not_accrue_work() -> None:
    collector = Collector()
    collector.tick(1000, 1, observed())
    rows = collector.tick(3000, 3, observed(idle=305))
    rows += collector.tick(5000, 5, observed(state="locked"))
    rows += collector.tick(7000, 7, observed(state="excluded"))
    rows += collector.flush()
    assert all(row.kind != "active" for row in rows)


def test_day_clipping_and_focus_are_deterministic() -> None:
    rows = [
        {
            "id": "a",
            "start": 0,
            "end": 700000,
            "app": "code.exe",
            "category": "Work",
            "kind": "active",
        },
        {
            "id": "b",
            "start": 700000,
            "end": 800000,
            "app": "slack.exe",
            "category": "Communication",
            "kind": "active",
        },
    ]
    summary = summarize(rows, 100000, 900000)
    assert summary["trackedMs"] == 700000
    assert summary["focusMs"] == 700000
    assert summary["switches"] == 1
    assert sum(item["ms"] for item in summary["categories"]) == summary["trackedMs"]


def test_encrypted_restart_correction_undo_and_scope(tmp_path: Path) -> None:
    path = tmp_path / "activity.vault"
    with ProductivityStore(path) as store:
        scope = store.scope
        record = store.add_segment(
            1000, 4000, "code.exe", "PRIVATE CANARY 813", "display-1", "active"
        )
        store.correct(record, "Personal", "Sample project")
        store.save()
    assert b"PRIVATE CANARY 813" not in path.read_bytes()
    assert b"SQLite format" not in path.read_bytes()
    assert set(p.name for p in tmp_path.iterdir()) == {"activity.vault", "activity.lock"}
    with ProductivityStore(path) as store:
        assert store.scope == scope
        row = store.rows(0, 10000)[0]
        assert (row["category"], row["project"]) == ("Personal", "Sample project")
        store.correct(record, None, "")
        assert store.rows(0, 10000)[0]["category"] == "Work"
        with pytest.raises(ValueError):
            store.correct("seg_" + "f" * 32, "Work", "")


def test_corrupt_vault_is_preserved_and_second_writer_is_denied(tmp_path: Path) -> None:
    path = tmp_path / "activity.vault"
    with ProductivityStore(path) as first:
        first.save()
        with pytest.raises(OSError):
            ProductivityStore(path)
    encrypted = path.read_bytes()
    path.write_bytes(encrypted[:30] + b"tampered")
    corrupt = path.read_bytes()
    with pytest.raises((OSError, ValueError)):
        ProductivityStore(path)
    assert path.read_bytes() == corrupt


def test_app_rule_and_delete_persist(tmp_path: Path) -> None:
    path = tmp_path / "activity.vault"
    with ProductivityStore(path) as store:
        store.add_segment(1000, 5000, "browser.exe", "", "display-1", "active")
        store.set_rule("browser.exe", "Learning")
        assert store.rows(0, 10000)[0]["category"] == "Learning"
        store.delete_range(0, 10000)
        assert store.rows(0, 10000) == []
    with ProductivityStore(path) as store:
        assert store.rows(0, 10000) == []


def test_day_deletion_removes_vision_evidence_and_usage(tmp_path: Path) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        receipt = store.add_vision_result(
            5000,
            "chrome.exe",
            "DISPLAY1",
            {
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
            },
            False,
            200,
        )
        store.confirm_image_discarded(receipt, 6000)
        assert store.vision_usage(0, 10000)["requests"] == 1
        assert store.vision_log() == {
            "attempts": 1,
            "screenshots": 1,
            "successful": 1,
            "failed": 0,
            "inputTokens": 100,
            "outputTokens": 20,
            "estimatedUsd": 0.0002,
            "entries": [
                {
                    "observedAt": 5000,
                    "status": "success",
                    "model": "claude-haiku-4-5-20251001",
                    "latencyMs": 200,
                    "inputTokens": 100,
                    "outputTokens": 20,
                    "errorCode": "",
                    "screenshotCaptured": 1,
                    "evidenceCommitted": 1,
                    "imageDisposition": "discarded_after_commit",
                    "disposedAt": 6000,
                }
            ],
        }
        store.delete_range(0, 10000)
        assert store.vision_usage(0, 10000) == {
            "requests": 0,
            "inputTokens": 0,
            "outputTokens": 0,
        }
        assert store.connection.execute("SELECT count(*) FROM activity_evidence").fetchone()[0] == 0


def test_clock_rollback_cannot_double_count_existing_time() -> None:
    collector = Collector(watermark=10000)
    collector.tick(5000, 1, observed())
    collector.tick(7000, 3, observed())
    collector.tick(9000, 5, observed())
    collector.tick(11000, 7, observed())
    rows = collector.flush()
    assert [(row.start, row.end) for row in rows] == [(10000, 11000)]


def test_focus_total_never_includes_uncaptured_gaps() -> None:
    rows = [
        {"start": 0, "end": 300000, "app": "code.exe", "category": "Work", "kind": "active"},
        {
            "start": 302000,
            "end": 602000,
            "app": "winword.exe",
            "category": "Work",
            "kind": "active",
        },
    ]
    summary = summarize(rows, 0, 900000)
    assert summary["focusMs"] == summary["trackedMs"] == 600000


def test_failed_atomic_publish_preserves_last_saved_vault(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "activity.vault"
    with ProductivityStore(path) as store:
        original = path.read_bytes()
        store.add_segment(1000, 2000, "code.exe", "NEW PRIVATE CANARY", "display", "active")

        def fail_replace(_source: object, _destination: object) -> None:
            raise OSError("synthetic failure")

        monkeypatch.setattr("ascend_engine.storage.productivity.os.replace", fail_replace)
        with pytest.raises(OSError):
            store.save()
        assert path.read_bytes() == original
        assert not list(tmp_path.glob("*.pending"))


def test_day_deletion_preserves_adjacent_time_and_corrections(tmp_path: Path) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        identifier = store.add_segment(1000, 61000, "code.exe", "Synthetic", "display", "active")
        store.correct(identifier, "Personal", "Context")
        store.delete_range(20000, 40000)
        rows = store.rows(0, 100000)
        assert [(row["start"], row["end"]) for row in rows] == [(1000, 20000), (40000, 61000)]
        assert all(row["category"] == "Personal" and row["project"] == "Context" for row in rows)


def test_hard_link_vault_is_rejected(tmp_path: Path) -> None:
    import os

    path = tmp_path / "activity.vault"
    with ProductivityStore(path):
        pass
    os.link(path, tmp_path / "alias.vault")
    with pytest.raises(OSError, match="vault_path_unsafe"):
        ProductivityStore(path)


def test_foreign_scope_is_never_read_or_corrected(tmp_path: Path) -> None:
    with ProductivityStore(tmp_path / "activity.vault") as store:
        record = store.add_segment(1000, 2000, "code.exe", "Synthetic", "display", "active")
        owner_scope = store.scope
        store.scope = ("act_" + "f" * 32, owner_scope[1], owner_scope[2], owner_scope[3])
        assert store.rows(0, 10000) == []
        with pytest.raises(ValueError, match="unknown_record"):
            store.correct(record, "Personal", "")
        store.scope = owner_scope
