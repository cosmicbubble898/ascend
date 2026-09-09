# Task 6 storage review — 2026-09-05

**Result:** Complete for local synthetic development. The engine now has the approved six-table foundation and a numbered migration runner. Product startup, bootstrap, user records, and permissions are not implemented by this change.

## Implementation

- `src/ascend_engine/storage/migrations/0001_foundation.sql` matches the approved SQL in `docs/DATA-MODEL.md` exactly.
- `migration_runner.py` discovers bundled UTF-8 migrations, canonicalizes line endings, hashes their bytes, and verifies schema objects, version, and ledger before writes.
- Each migration and ledger insert share one explicit transaction. DDL errors and interruption roll back. An already-active caller transaction is rejected without committing or rolling it back.
- Repeated runs preserve the database. Drift, invalid bundles, corrupt rows, future versions, and attached databases fail visibly. Writer contention has a 250 ms SQLite busy timeout without a retry loop.
- Logs contain only approved migration metadata, duration, and typed outcomes. No SQL, parameters, exception traceback, user content, account IDs, or paths are logged.

## Verification

| Check | Observed result |
| --- | --- |
| TDD: fresh database | Failed because storage module was absent; passed after minimum implementation |
| TDD: repeat and drift handling | Failed on repeat DDL or absent refusal; passed after guards |
| TDD: invalid migration bundles | Nine missing-rejection cases failed; passed after discovery validation |
| TDD: integrity, busy, caller transaction, attached/temp state | Six missing-behavior cases failed; passed after connection/integrity checks |
| TDD: content-free logging | Failed because no outcome was logged; passed after logging |
| TDD: interruption | Failed because transaction remained open; passed after rollback handling |
| Focused storage tests | 49 passed, including timestamp/type constraints, foreign keys, upgrade order, checksum/name drift, rollback, and no-op persistence |
| Full `scripts/check.ps1` | Passed: 51 Python tests, 3 shell tests, 31 script tests; lock check, Ruff, mypy, Prettier, ESLint, TypeScript checks/build |
| Offline Python wheel build | Passed with existing locked build backend |
| Wheel resource smoke | Loaded module directly from wheel in isolated Python; bundled SQL applied successfully to an in-memory database; 12 archive entries, all expected package/metadata paths |
| `git diff --check` | Passed |

The first constraint review exposed two test-fixture mistakes (membership prefix and misplaced assertion); these were corrected without changing the approved SQL. They were not missing production behaviors.

## Review and limits

Code-quality and storage-security review checked transaction ownership, bound parameters, schema comparison, content-free failures, package resource loading, and cross-tenant foreign keys. The only SQLite connection opened in production source is the temporary in-memory schema reference inside the storage boundary. No dependency or lockfile changed.

The runner accepts only a trusted internal engine connection. It is not an exposed query API or a complete scoped data-access layer. Bundle checksums detect drift; they do not authenticate application files against a same-user attacker. Plain SQLite is still synthetic-only. Windows vault identity/ACLs remain OD-21; authorization remains Task 8. Existing SQLite constraints are defense in depth; later typed ID and input validation remains mandatory.

The Python wheel resource path is verified. The Electron/PyInstaller installer was not rebuilt; its resource inclusion and startup integration must be verified when the engine begins using storage. No new app-data files or real personal data were created.

Known build-tool dependency advisories reported during the preceding audit remain unresolved; this storage change does not clear them or qualify a release. No commit, push, installer distribution, or deployment was performed.

## Source check

The implementation uses existing CPython 3.13.14 and standard-library SQLite. [Python's sqlite3 documentation](https://docs.python.org/3.13/library/sqlite3.html) explains why `executescript()` cannot safely stand in for the explicit transaction here. [SQLite transactions](https://www.sqlite.org/lang_transaction.html) and [PRAGMA checks](https://www.sqlite.org/pragma.html) were reviewed for transaction and integrity behavior. No new SDK or framework was selected.
