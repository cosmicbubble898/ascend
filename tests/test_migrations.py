"""Behavioral proof of the approved synthetic-only storage foundation."""

import logging
import sqlite3
import time
from contextlib import closing
from pathlib import Path

import pytest

from ascend_engine.storage import migration_runner
from ascend_engine.storage.migration_runner import migrate

STAMP = "2026-09-05T08:00:00.000Z"


def test_fresh_database_applies_the_approved_foundation() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        assert migrate(connection, applied_at_utc=STAMP, application_version="0.0.0") == (
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
        )
        tables = connection.execute(
            "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name"
        ).fetchall()
        assert tables == [
            ("activity_capture_signals",),
            ("activity_context",),
            ("activity_corrections",),
            ("activity_evidence",),
            ("activity_segments",),
            ("actors",),
            ("devices",),
            ("productivity_plans",),
            ("productivity_settings",),
            ("schema_migrations",),
            ("screen_analysis_runs",),
            ("tenants",),
            ("workspace_memberships",),
            ("workspaces",),
        ]
        assert connection.execute("PRAGMA user_version").fetchone() == (8,)
        assert connection.execute("PRAGMA foreign_keys").fetchone() == (1,)
        assert connection.execute("PRAGMA trusted_schema").fetchone() == (0,)
        assert all(
            row[4:] == (1, 1)
            for row in connection.execute("PRAGMA table_list")
            if row[1] not in ("sqlite_schema", "sqlite_temp_schema")
        )
        assert connection.execute(
            "SELECT version, name, applied_at_utc, application_version FROM schema_migrations"
        ).fetchall() == [
            (1, "foundation", STAMP, "0.0.0"),
            (2, "productivity", STAMP, "0.0.0"),
            (3, "productivity_tools", STAMP, "0.0.0"),
            (4, "activity_evidence", STAMP, "0.0.0"),
            (5, "analysis_capture_log", STAMP, "0.0.0"),
            (6, "backfill_capture_log", STAMP, "0.0.0"),
            (7, "activity_signal_fusion", STAMP, "0.0.0"),
            (8, "activity_llm_fusion", STAMP, "0.0.0"),
        ]


def test_second_startup_preserves_the_ledger_and_database() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        before = connection.serialize()
        assert (
            migrate(
                connection, applied_at_utc="2026-09-06T09:00:00.000Z", application_version="0.0.1"
            )
            == ()
        )
        assert connection.serialize() == before


@pytest.mark.parametrize(
    "tamper",
    [
        "UPDATE schema_migrations SET checksum_sha256 = '" + "0" * 64 + "'",
        "UPDATE schema_migrations SET name = 'renamed' WHERE version = 1",
        "DELETE FROM schema_migrations",
        "PRAGMA user_version = 0",
        "PRAGMA user_version = 9",
        "DROP INDEX ix_devices_owner_state",
        "CREATE TABLE unexpected (secret TEXT)",
        "ALTER TABLE actors ADD COLUMN extra TEXT",
    ],
)
def test_invalid_existing_database_is_rejected_without_writes(tamper: str) -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        connection.execute(tamper)
        connection.commit()
        before = connection.serialize()
        with pytest.raises(migration_runner.MigrationError):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert connection.serialize() == before
        assert not connection.in_transaction


def test_bundled_migration_matches_the_approved_sql() -> None:
    project = Path(__file__).resolve().parents[1]
    specification = (project / "docs/DATA-MODEL.md").read_text(encoding="utf-8")
    expected = specification.split("```sql\n", 1)[1].split("\n```", 1)[0] + "\n"
    actual = (project / "src/ascend_engine/storage/migrations/0001_foundation.sql").read_text(
        encoding="utf-8"
    )
    assert actual == expected


@pytest.mark.parametrize(
    "filenames,invalid_bytes",
    [
        ([], None),
        (["0002_foundation.sql"], None),
        (["0001_foundation.sql", "0001_duplicate.sql"], None),
        (["0001_foundation.sql", "0003_gap.sql"], None),
        (["0000_foundation.sql"], None),
        (["unversioned.sql"], None),
        (["0001_foundation.sql"], b"\xef\xbb\xbfSELECT 1;\n"),
        (["0001_foundation.sql"], b"\xff\xfeinvalid"),
        (["0001_foundation.sql"], b"CREATE TABLE incomplete (id INT)"),
    ],
)
def test_invalid_migration_bundle_is_rejected_before_writes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    filenames: list[str],
    invalid_bytes: bytes | None,
) -> None:
    original = (
        Path(__file__)
        .resolve()
        .parents[1]
        .joinpath("src/ascend_engine/storage/migrations/0001_foundation.sql")
        .read_bytes()
    )
    for name in filenames:
        (tmp_path / name).write_bytes(original if invalid_bytes is None else invalid_bytes)
    monkeypatch.setattr(migration_runner, "_bundle_root", lambda: tmp_path, raising=False)
    with closing(sqlite3.connect(":memory:")) as connection:
        statements: list[str] = []
        connection.set_trace_callback(statements.append)
        with pytest.raises(migration_runner.MigrationError, match="invalid_migrations"):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert not any(sql.startswith("BEGIN") for sql in statements)
        assert connection.execute("SELECT name FROM sqlite_schema").fetchall() == []


def test_line_endings_do_not_change_a_recorded_checksum(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = (
        Path(__file__)
        .resolve()
        .parents[1]
        .joinpath("src/ascend_engine/storage/migrations/0001_foundation.sql")
        .read_bytes()
    )
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        for entry in migration_runner._bundle_root().iterdir():
            if entry.name != "0001_foundation.sql":
                (tmp_path / entry.name).write_bytes(entry.read_bytes())
        (tmp_path / "0001_foundation.sql").write_bytes(original.replace(b"\n", b"\r\n") + b"\r\n")
        monkeypatch.setattr(migration_runner, "_bundle_root", lambda: tmp_path, raising=False)
        assert migrate(connection, applied_at_utc=STAMP, application_version="0.0.0") == ()


@pytest.mark.parametrize("corruption", ["foreign_key", "check_constraint"])
def test_invalid_stored_rows_block_startup(corruption: str) -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        if corruption == "foreign_key":
            connection.execute("PRAGMA foreign_keys = OFF")
            connection.execute(
                "INSERT INTO devices VALUES (?, ?, 'windows_installation', 'active', ?, ?, ?, NULL)",
                ("dev_" + "1" * 32, "act_" + "2" * 32, STAMP, STAMP, STAMP),
            )
        else:
            connection.execute("PRAGMA ignore_check_constraints = ON")
            connection.execute(
                "INSERT INTO actors VALUES ('bad_identifier', 'active', ?, ?, NULL)", (STAMP, STAMP)
            )
        connection.commit()
        connection.execute("PRAGMA ignore_check_constraints = OFF")
        before = connection.serialize()
        with pytest.raises(migration_runner.MigrationError, match="integrity_check_failed"):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert connection.serialize() == before


def test_denied_ddl_rolls_back_the_whole_migration() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:

        def authorize(
            action: int,
            first: str | None,
            second: str | None,
            database: str | None,
            trigger: str | None,
        ) -> int:
            if action == sqlite3.SQLITE_CREATE_INDEX and first == "ix_devices_owner_state":
                return sqlite3.SQLITE_DENY
            return sqlite3.SQLITE_OK

        connection.set_authorizer(authorize)
        with pytest.raises(migration_runner.MigrationError, match="migration_failed"):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert connection.execute("SELECT name FROM sqlite_schema").fetchall() == []
        assert connection.execute("PRAGMA user_version").fetchone() == (0,)
        assert not connection.in_transaction


@pytest.mark.parametrize(
    "column,value",
    [
        (0, b"act_" + b"a" * 32),
        (0, "dev_" + "a" * 32),
        (0, "act_" + "A" * 32),
        (0, "act_" + "a" * 31),
        (1, "unknown"),
        (1, "deleted"),
        (2, "2026-09-05"),
        (2, "2026-09-05T08:00:00Z"),
        (2, "2026-09-05T08:00:00.000+00:00"),
        (2, "0000-09-05T08:00:00.000Z"),
        (2, "2026-09-05T24:00:00.000Z"),
        (2, "2026-02-30T08:00:00.000Z"),
        (2, "2026-13-05T08:00:00.000Z"),
        (3, "2026-09-04T08:00:00.000Z"),
        (4, STAMP),
    ],
)
def test_invalid_foundation_values_are_rejected(column: int, value: str | bytes) -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        row: list[str | bytes | None] = ["act_" + "a" * 32, "active", STAMP, STAMP, None]
        row[column] = value
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("INSERT INTO actors VALUES (?, ?, ?, ?, ?)", row)
        assert connection.execute("SELECT count(*) FROM actors").fetchone() == (0,)


def test_membership_cannot_mix_a_valid_workspace_with_another_tenant() -> None:
    actor, first_tenant, second_tenant, workspace = (
        "act_" + "a" * 32,
        "ten_" + "1" * 32,
        "ten_" + "2" * 32,
        "wsp_" + "3" * 32,
    )
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        connection.execute(
            "INSERT INTO actors VALUES (?, 'active', ?, ?, NULL)", (actor, STAMP, STAMP)
        )
        for tenant in (first_tenant, second_tenant):
            connection.execute(
                "INSERT INTO tenants VALUES (?, 'organization', NULL, 'active', ?, ?, NULL)",
                (tenant, STAMP, STAMP),
            )
        connection.execute(
            "INSERT INTO workspaces VALUES (?, ?, 'collaborative', 'active', ?, ?, NULL)",
            (workspace, first_tenant, STAMP, STAMP),
        )
        with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
            connection.execute(
                "INSERT INTO workspace_memberships VALUES (?, ?, ?, ?, 'owner', 'active', ?, ?, NULL)",
                ("mbr_" + "4" * 32, second_tenant, workspace, actor, STAMP, STAMP),
            )
        with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY"):
            connection.execute("DELETE FROM tenants WHERE tenant_id = ?", (first_tenant,))
        assert connection.execute("SELECT count(*) FROM workspace_memberships").fetchone() == (0,)


def test_busy_writer_returns_a_bounded_typed_failure(tmp_path: Path) -> None:
    path = tmp_path / "synthetic.db"
    with (
        closing(sqlite3.connect(path)) as writer,
        closing(sqlite3.connect(path, timeout=0.01)) as contender,
    ):
        writer.execute("BEGIN IMMEDIATE")
        started = time.monotonic()
        with pytest.raises(migration_runner.MigrationError, match="busy"):
            migrate(contender, applied_at_utc=STAMP, application_version="0.0.0")
        assert time.monotonic() - started < 2
        assert writer.in_transaction
        writer.rollback()
        assert contender.execute("SELECT name FROM sqlite_schema").fetchall() == []


def test_existing_transaction_is_never_committed_or_rolled_back() -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        connection.execute("CREATE TABLE caller_work (id INT)")
        connection.execute("INSERT INTO caller_work VALUES (1)")
        with pytest.raises(migration_runner.MigrationError, match="invalid_connection"):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert connection.in_transaction
        assert connection.execute("SELECT * FROM caller_work").fetchall() == [(1,)]


@pytest.mark.parametrize(
    "extra", ["ATTACH DATABASE ':memory:' AS other", "CREATE TEMP TABLE x (id)"]
)
def test_connections_with_extra_databases_or_temp_objects_are_rejected(extra: str) -> None:
    with closing(sqlite3.connect(":memory:")) as connection:
        connection.execute(extra)
        with pytest.raises(migration_runner.MigrationError, match="invalid_connection"):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert connection.execute("SELECT name FROM main.sqlite_schema").fetchall() == []


def test_migration_outcomes_are_logged_without_parameters(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger=migration_runner.__name__)
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="private-version-marker")
        connection.execute("CREATE TABLE private_table_marker (private_column_marker TEXT)")
        with pytest.raises(migration_runner.MigrationError, match="schema_mismatch"):
            migrate(connection, applied_at_utc=STAMP, application_version="private-version-marker")
    assert "outcome=applied" in caplog.text
    assert "version=1 name=foundation checksum=" in caplog.text
    assert "outcome=schema_mismatch" in caplog.text
    assert "duration_ms=" in caplog.text
    assert "private-" not in caplog.text
    assert "private_" not in caplog.text
    assert STAMP not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)


def test_interrupted_migration_rolls_back_before_propagating(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = migration_runner._run_sql
    with closing(sqlite3.connect(":memory:")) as connection:

        def interrupt_after_ddl(target: sqlite3.Connection, sql: str) -> None:
            original(target, sql)
            if target is connection:
                raise KeyboardInterrupt

        monkeypatch.setattr(migration_runner, "_run_sql", interrupt_after_ddl)
        with pytest.raises(KeyboardInterrupt):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert not connection.in_transaction
        assert connection.execute("SELECT name FROM sqlite_schema").fetchall() == []
        assert connection.execute("PRAGMA user_version").fetchone() == (0,)


def test_file_database_upgrades_in_order_and_preserves_prior_ledger(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    original = migration_runner._bundle_root().joinpath("0001_foundation.sql").read_bytes()
    (bundle / "0001_foundation.sql").write_bytes(original)
    (bundle / "0002_productivity.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0002_productivity.sql").read_bytes()
    )
    path = tmp_path / "synthetic.db"
    with closing(sqlite3.connect(path)) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        initial = connection.execute("SELECT * FROM schema_migrations").fetchone()
    # Synthetic future migration only: no new production schema is introduced.
    (bundle / "0003_productivity_tools.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0003_productivity_tools.sql").read_bytes()
    )
    (bundle / "0004_activity_evidence.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0004_activity_evidence.sql").read_bytes()
    )
    (bundle / "0005_analysis_capture_log.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0005_analysis_capture_log.sql").read_bytes()
    )
    (bundle / "0006_backfill_capture_log.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0006_backfill_capture_log.sql").read_bytes()
    )
    (bundle / "0007_activity_signal_fusion.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0007_activity_signal_fusion.sql").read_bytes()
    )
    (bundle / "0008_activity_llm_fusion.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0008_activity_llm_fusion.sql").read_bytes()
    )
    (bundle / "0009_test_index.sql").write_text(
        "CREATE INDEX ix_test_actor_state ON actors (lifecycle_state);\nPRAGMA user_version = 9;\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(migration_runner, "_bundle_root", lambda: bundle)
    with closing(sqlite3.connect(path)) as connection:
        assert migrate(connection, applied_at_utc=STAMP, application_version="0.0.1") == (9,)
        assert (
            connection.execute("SELECT * FROM schema_migrations WHERE version = 1").fetchone()
            == initial
        )
        assert connection.execute(
            "SELECT version FROM schema_migrations ORDER BY version"
        ).fetchall() == [(1,), (2,), (3,), (4,), (5,), (6,), (7,), (8,), (9,)]
        assert migrate(connection, applied_at_utc=STAMP, application_version="0.0.1") == ()


@pytest.mark.parametrize("edit", ["checksum", "name"])
def test_changing_an_applied_bundled_file_blocks_startup(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, edit: str
) -> None:
    original = migration_runner._bundle_root().joinpath("0001_foundation.sql").read_bytes()
    (tmp_path / "0002_productivity.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0002_productivity.sql").read_bytes()
    )
    (tmp_path / "0003_productivity_tools.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0003_productivity_tools.sql").read_bytes()
    )
    (tmp_path / "0004_activity_evidence.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0004_activity_evidence.sql").read_bytes()
    )
    (tmp_path / "0005_analysis_capture_log.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0005_analysis_capture_log.sql").read_bytes()
    )
    (tmp_path / "0006_backfill_capture_log.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0006_backfill_capture_log.sql").read_bytes()
    )
    (tmp_path / "0007_activity_signal_fusion.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0007_activity_signal_fusion.sql").read_bytes()
    )
    (tmp_path / "0008_activity_llm_fusion.sql").write_bytes(
        migration_runner._bundle_root().joinpath("0008_activity_llm_fusion.sql").read_bytes()
    )
    with closing(sqlite3.connect(":memory:")) as connection:
        migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        before = connection.serialize()
        name = "0001_renamed.sql" if edit == "name" else "0001_foundation.sql"
        (tmp_path / name).write_bytes(b"-- Changed bundled file\n" + original)
        monkeypatch.setattr(migration_runner, "_bundle_root", lambda: tmp_path)
        with pytest.raises(migration_runner.MigrationError, match="ledger_mismatch"):
            migrate(connection, applied_at_utc=STAMP, application_version="0.0.0")
        assert connection.serialize() == before
