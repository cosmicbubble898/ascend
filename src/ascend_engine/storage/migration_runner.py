"""Apply trusted bundled DDL to an engine-owned connection; never accept external SQL."""

import hashlib
import logging
import re
import sqlite3
import time
from contextlib import closing
from dataclasses import dataclass
from importlib.resources import files
from importlib.resources.abc import Traversable

type Schema = tuple[tuple[str, str, str, str], ...]
_LOGGER = logging.getLogger(__name__)


class MigrationError(RuntimeError):
    """A content-free failure code suitable for the engine boundary."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class _Migration:
    version: int
    name: str
    sql: str
    checksum: str


def _bundle_root() -> Traversable:
    return files("ascend_engine.storage").joinpath("migrations")


def _load_migrations() -> tuple[_Migration, ...]:
    migrations: list[_Migration] = []
    try:
        for entry in _bundle_root().iterdir():
            if not entry.name.endswith(".sql"):
                continue
            match = re.fullmatch(r"([0-9]{4})_([a-z0-9_]{1,100})\.sql", entry.name)
            if not entry.is_file() or match is None:
                raise MigrationError("invalid_migrations")
            sql = entry.read_bytes().decode("utf-8")
            if sql.startswith("\ufeff"):
                raise MigrationError("invalid_migrations")
            canonical = sql.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n") + "\n"
            migrations.append(
                _Migration(
                    int(match[1]),
                    match[2],
                    canonical,
                    hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
                )
            )
    except (OSError, UnicodeError):
        raise MigrationError("invalid_migrations") from None
    migrations.sort(key=lambda item: item.version)
    if (
        not migrations
        or [item.version for item in migrations] != list(range(1, len(migrations) + 1))
        or len({item.name for item in migrations}) != len(migrations)
    ):
        raise MigrationError("invalid_migrations")
    return tuple(migrations)


def _schema(connection: sqlite3.Connection) -> Schema:
    return tuple(
        (str(row[0]), str(row[1]), str(row[2]), str(row[3]))
        for row in connection.execute(
            "SELECT type, name, tbl_name, sql FROM main.sqlite_schema "
            "WHERE name NOT GLOB 'sqlite_*' ORDER BY type, name"
        )
    )


def _run_sql(connection: sqlite3.Connection, sql: str) -> None:
    # executescript can implicitly commit a caller's transaction. Execute complete
    # bundled statements individually so DDL and the ledger share one transaction.
    statement = ""
    for character in sql:
        statement += character
        if character == ";" and sqlite3.complete_statement(statement):
            connection.execute(statement)
            statement = ""
    if statement.strip():
        raise MigrationError("invalid_migrations")


def _expected_schemas(migrations: tuple[_Migration, ...]) -> dict[int, Schema]:
    expected: dict[int, Schema] = {0: ()}
    try:
        with closing(sqlite3.connect(":memory:")) as reference:
            reference.execute("PRAGMA foreign_keys = ON")
            reference.execute("PRAGMA trusted_schema = OFF")
            for migration in migrations:
                _run_sql(reference, migration.sql)
                if reference.execute("PRAGMA user_version").fetchone() != (migration.version,):
                    raise MigrationError("invalid_migrations")
                expected[migration.version] = _schema(reference)
    except sqlite3.Error:
        raise MigrationError("invalid_migrations") from None
    return expected


def _validate_existing(
    connection: sqlite3.Connection, migrations: tuple[_Migration, ...], expected: dict[int, Schema]
) -> int:
    version = int(connection.execute("PRAGMA user_version").fetchone()[0])
    if version > len(migrations):
        raise MigrationError("future_version")
    if version < 0 or _schema(connection) != expected[version]:
        raise MigrationError("schema_mismatch")
    if version:
        ledger = connection.execute(
            "SELECT version, name, checksum_sha256 FROM main.schema_migrations ORDER BY version"
        ).fetchall()
        if ledger != [(item.version, item.name, item.checksum) for item in migrations[:version]]:
            raise MigrationError("ledger_mismatch")
    return version


def _prepare_connection(connection: sqlite3.Connection) -> None:
    if connection.in_transaction or connection.row_factory is not None:
        raise MigrationError("invalid_connection")
    if any(row[1] not in ("main", "temp") for row in connection.execute("PRAGMA database_list")):
        raise MigrationError("invalid_connection")
    if connection.execute("SELECT name FROM temp.sqlite_schema LIMIT 1").fetchone():
        raise MigrationError("invalid_connection")
    connection.execute("PRAGMA busy_timeout = 250")
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA trusted_schema = OFF")
    connection.execute("PRAGMA ignore_check_constraints = OFF")
    if connection.execute("PRAGMA foreign_keys").fetchone() != (1,) or connection.execute(
        "PRAGMA trusted_schema"
    ).fetchone() != (0,):
        raise MigrationError("invalid_connection")


def _check_integrity(connection: sqlite3.Connection) -> None:
    if connection.execute("PRAGMA main.foreign_key_check").fetchall() or connection.execute(
        "PRAGMA main.quick_check"
    ).fetchall() != [("ok",)]:
        raise MigrationError("integrity_check_failed")


def migrate(
    connection: sqlite3.Connection, *, applied_at_utc: str, application_version: str
) -> tuple[int, ...]:
    """Apply missing versions; caller supplies an idle internal DAL connection.

    No app path, external migration directory, account data, or product startup is
    accepted here. The caller owns connection lifetime. Task 7 wires the vault.
    """
    began = time.monotonic()
    applied: list[int] = []
    started = False
    try:
        migrations = _load_migrations()
        expected = _expected_schemas(migrations)
        _prepare_connection(connection)
        while True:
            connection.execute("BEGIN IMMEDIATE")
            started = True
            version = _validate_existing(connection, migrations, expected)
            _check_integrity(connection)
            if version == len(migrations):
                connection.execute("COMMIT")
                started = False
                _LOGGER.info("outcome=verified duration_ms=%.3f", (time.monotonic() - began) * 1000)
                return tuple(applied)
            migration = migrations[version]
            migration_began = time.monotonic()
            _run_sql(connection, migration.sql)
            connection.execute(
                "INSERT INTO main.schema_migrations VALUES (?, ?, ?, ?, ?)",
                (
                    migration.version,
                    migration.name,
                    migration.checksum,
                    applied_at_utc,
                    application_version,
                ),
            )
            _validate_existing(connection, migrations, expected)
            _check_integrity(connection)
            connection.execute("COMMIT")
            started = False
            applied.append(migration.version)
            _LOGGER.info(
                "version=%d name=%s checksum=%s outcome=applied duration_ms=%.3f",
                migration.version,
                migration.name,
                migration.checksum,
                (time.monotonic() - migration_began) * 1000,
            )
    except BaseException as error:
        if started and connection.in_transaction:
            connection.execute("ROLLBACK")
        if not isinstance(error, (sqlite3.Error, MigrationError)):
            _LOGGER.warning(
                "outcome=interrupted duration_ms=%.3f", (time.monotonic() - began) * 1000
            )
            raise
        if isinstance(error, MigrationError):
            outcome = error.code
        else:
            code = getattr(error, "sqlite_errorcode", 0) & 0xFF
            if code in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
                outcome = "busy"
            elif code in (sqlite3.SQLITE_CORRUPT, sqlite3.SQLITE_NOTADB):
                outcome = "integrity_check_failed"
            else:
                outcome = "migration_failed"
        _LOGGER.warning("outcome=%s duration_ms=%.3f", outcome, (time.monotonic() - began) * 1000)
        raise MigrationError(outcome) from None
