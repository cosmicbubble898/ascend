# Migration 0001 Data-Model Specification

**Status:** Approved by founder on 2026-09-05 for synthetic implementation; Task 6 complete locally
**Owner task:** Task 5 in `tasks/todo.md`
**Prepared:** 2026-08-05

**Later implementation:** The requested basic productivity slice adds `0002_productivity.sql`, leaving the exact migration 0001 SQL below unchanged. Its engine-owned, scoped activity/correction/settings tables and encrypted snapshot persistence are described in `docs/BASIC-PRODUCTIVITY-SPEC.md`. The live personal identity is retained within that encrypted productivity vault; the older separate installation.json proposal remains distinct.

## Approval gate

The 2026-09-06 requested expansion adds migration 0003_productivity_tools.sql: scoped daily task plans and per-segment project/task/planning context. Existing migrations 0001/0002 remain immutable. The encrypted v2-to-v3 upgrade is covered by a history-and-identity preservation test. See PRODUCTIVITY-EXPANSION-SPEC.md.

This document is the exact approved schema and behavior for migration 0001. The founder approved proceeding on 2026-09-05 in response to the explicit storage-specification approval request. Approval authorizes synthetic-data implementation through Tasks 6-8 only, retaining OD-21 before Task 7; it does not authorize real user data, encryption claims, cloud identity, integrations, memory records, organization features, screenshots, agents, or deployment.

OD-02 and ADR-0001 approved the minimal organization-ready principle. OD-02A keeps Ascend account/authorization boundaries separate from entities represented inside memory. OD-03 permits plain SQLite/files only for synthetic development data. Task 4 now has a bounded local installer `go` result, so this specification may proceed.

## Scope of migration 0001

Migration 0001 contains only:

1. `schema_migrations`
2. `actors`
3. `tenants`
4. `workspaces`
5. `workspace_memberships`
6. `devices`
7. The indexes and SQLite `user_version` value required by those tables

It intentionally contains no dictation, activity, meeting, transcript, task, calendar, memory, entity/context, search, embedding, provider connection, credential, MCP/API client, screenshot, model, skill, agent, workflow, billing, invitation, audit-event, or organization-administration tables. Each enters through its own later approved vertical slice. No speculative nullable columns are reserved for them.

Migration 0001 contains no user-entered profile fields, Windows username, email address, machine serial, MAC address, hostname, provider ID, or other real personal content.

## Conceptual boundaries and terminology

- **Actor:** Ascend's stable identity for a person. It is not an email address, Windows account, role, tenant, or membership.
- **Tenant:** A personal or future organization Ascend account. It is the top-level ownership and authorization boundary.
- **Workspace:** A data and collaboration scope owned by exactly one tenant.
- **Workspace membership:** The actor-to-workspace relationship carrying a role and lifecycle state. Roles do not live on actors.
- **Device:** A random Ascend installation identity owned by an actor. It is not a hardware fingerprint and is not permanently tied to one tenant.
- **Memory entity/context:** A future personal or professional subject represented inside memory—for example a person, relationship, organization/client, project, topic, goal, habit, place, event, or life area. It is user data, not an Ascend account, and can never authorize access.

`tenant_id` is used only for Ascend account scope. A future memory entity/context uses a different table, ID prefix, Python type, repository, and authorization path. The generic name `organization_id` is prohibited because it could mean either an Ascend organization account or an organization mentioned in memory.

## SQLite baseline

- Runtime: CPython 3.13.14 standard-library `sqlite3`; the approved environment currently provides SQLite 3.53.1.
- Minimum supported SQLite for this database: 3.37.0, because every table is `STRICT`.
- Every table is also `WITHOUT ROWID`; code cannot treat an implicit row number as identity.
- The engine opens the only application database connection boundary. Every connection executes and verifies `PRAGMA foreign_keys = ON` before beginning a transaction.
- Every connection sets `PRAGMA trusted_schema = OFF`. Migration SQL uses no application-defined SQL functions, virtual tables, triggers, or dynamic extensions.
- Migration and bootstrap writes use `BEGIN IMMEDIATE`; `SQLITE_BUSY` is a visible bounded failure, not an invitation to retry forever.
- Migration SQL is static and bundled. Table names, column names, PRAGMA values, and DDL are never built from user/import/provider/model input.
- The engine resolves the database under its fixed application-data root; no user, imported content, provider, model, renderer, or external client supplies the database path. SQLite extension loading and `ATTACH DATABASE` are not enabled.
- `PRAGMA user_version` mirrors the highest applied migration version; `schema_migrations` remains the authoritative checksum ledger.
- No downgrade path is provided. Back up and restore are later separately specified features.

The source basis is SQLite's official documentation for [STRICT tables](https://www.sqlite.org/stricttables.html), [WITHOUT ROWID tables](https://www.sqlite.org/withoutrowid.html), [foreign keys](https://www.sqlite.org/foreignkeys.html), [transactions](https://www.sqlite.org/lang_transaction.html), and [PRAGMAs](https://www.sqlite.org/pragma.html), reviewed on 2026-08-05.

## Exact value conventions

### Stable typed IDs

Application code generates 128 random bits with Python's standard-library cryptographic randomness and encodes 32 lowercase hexadecimal characters after a four-character type prefix:

| Type       | Format                    | Example shape                          |
| ---------- | ------------------------- | -------------------------------------- |
| Actor      | `act_` + 32 lowercase hex | `act_00000000000000000000000000000000` |
| Tenant     | `ten_` + 32 lowercase hex | `ten_00000000000000000000000000000000` |
| Workspace  | `wsp_` + 32 lowercase hex | `wsp_00000000000000000000000000000000` |
| Membership | `mbr_` + 32 lowercase hex | `mbr_00000000000000000000000000000000` |
| Device     | `dev_` + 32 lowercase hex | `dev_00000000000000000000000000000000` |

IDs are immutable, globally unique, case-sensitive `TEXT`, and exactly 36 ASCII characters. The database checks each prefix, length, and lowercase hexadecimal suffix. Python uses distinct `ActorId`, `TenantId`, `WorkspaceId`, `MembershipId`, and `DeviceId` types; a generic unvalidated string is rejected at the data-access boundary.

### UTC timestamps

All timestamps are application-supplied UTC text in exactly `YYYY-MM-DDTHH:MM:SS.sssZ` format, with millisecond precision—for example `2026-08-05T12:34:56.789Z`. Years are `0001` through `9999`, and hours are `00` through `23`; SQLite's accepted `0000` year and `24:00` spelling are deliberately rejected. SQLite `strftime` checks and normalizes the remaining calendar fields. No schema default uses the local clock or `CURRENT_TIMESTAMP`. Tests use a supplied clock.

For every row, `updated_at_utc >= created_at_utc`. A deletion, ending, or retirement timestamp cannot precede creation or be later than `updated_at_utc`. Fixed UTC text permits lexical ordering.

## Exact migration-0001 SQL contract

Task 6 must place the following DDL in `src/ascend_engine/storage/migrations/0001_foundation.sql`. Only formatting and comments may differ while creating that file; its schema, constraints, indexes, and PRAGMA value must be identical to this contract. The runner rejects a BOM or non-UTF-8 input, normalizes CRLF or lone CR to LF, requires one final LF, and hashes those canonical bytes with SHA-256. Once any database records that checksum, the canonical migration is immutable.

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    checksum_sha256 TEXT NOT NULL,
    applied_at_utc TEXT NOT NULL,
    application_version TEXT NOT NULL,
    CHECK (version > 0),
    CHECK (
        length(name) BETWEEN 1 AND 100
        AND name NOT GLOB '*[^a-z0-9_]*'
    ),
    CHECK (
        length(checksum_sha256) = 64
        AND checksum_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    CHECK (
        applied_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', applied_at_utc)
    ),
    CHECK (
        substr(applied_at_utc, 1, 4) <> '0000'
        AND substr(applied_at_utc, 12, 2) BETWEEN '00' AND '23'
    ),
    CHECK (length(application_version) BETWEEN 1 AND 64)
) STRICT, WITHOUT ROWID;

CREATE TABLE actors (
    actor_id TEXT PRIMARY KEY,
    lifecycle_state TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    deleted_at_utc TEXT,
    CHECK (
        length(actor_id) = 36
        AND substr(actor_id, 1, 4) = 'act_'
        AND substr(actor_id, 5) NOT GLOB '*[^0-9a-f]*'
    ),
    CHECK (lifecycle_state IN ('active', 'deleted')),
    CHECK (
        created_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at_utc)
    ),
    CHECK (
        updated_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at_utc)
    ),
    CHECK (
        deleted_at_utc IS NULL
        OR deleted_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at_utc)
    ),
    CHECK (
        substr(created_at_utc, 1, 4) <> '0000'
        AND substr(created_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND substr(updated_at_utc, 1, 4) <> '0000'
        AND substr(updated_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND (
            deleted_at_utc IS NULL
            OR (
                substr(deleted_at_utc, 1, 4) <> '0000'
                AND substr(deleted_at_utc, 12, 2) BETWEEN '00' AND '23'
            )
        )
    ),
    CHECK (updated_at_utc >= created_at_utc),
    CHECK (deleted_at_utc IS NULL OR deleted_at_utc >= created_at_utc),
    CHECK (deleted_at_utc IS NULL OR updated_at_utc >= deleted_at_utc),
    CHECK (
        (lifecycle_state = 'active' AND deleted_at_utc IS NULL)
        OR (lifecycle_state = 'deleted' AND deleted_at_utc IS NOT NULL)
    )
) STRICT, WITHOUT ROWID;

CREATE TABLE tenants (
    tenant_id TEXT PRIMARY KEY,
    tenant_kind TEXT NOT NULL,
    personal_owner_actor_id TEXT UNIQUE,
    lifecycle_state TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    deleted_at_utc TEXT,
    CHECK (
        length(tenant_id) = 36
        AND substr(tenant_id, 1, 4) = 'ten_'
        AND substr(tenant_id, 5) NOT GLOB '*[^0-9a-f]*'
    ),
    CHECK (tenant_kind IN ('personal', 'organization')),
    CHECK (
        (tenant_kind = 'personal' AND personal_owner_actor_id IS NOT NULL)
        OR (tenant_kind = 'organization' AND personal_owner_actor_id IS NULL)
    ),
    CHECK (lifecycle_state IN ('active', 'deleted')),
    CHECK (
        created_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at_utc)
    ),
    CHECK (
        updated_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at_utc)
    ),
    CHECK (
        deleted_at_utc IS NULL
        OR deleted_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at_utc)
    ),
    CHECK (
        substr(created_at_utc, 1, 4) <> '0000'
        AND substr(created_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND substr(updated_at_utc, 1, 4) <> '0000'
        AND substr(updated_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND (
            deleted_at_utc IS NULL
            OR (
                substr(deleted_at_utc, 1, 4) <> '0000'
                AND substr(deleted_at_utc, 12, 2) BETWEEN '00' AND '23'
            )
        )
    ),
    CHECK (updated_at_utc >= created_at_utc),
    CHECK (deleted_at_utc IS NULL OR deleted_at_utc >= created_at_utc),
    CHECK (deleted_at_utc IS NULL OR updated_at_utc >= deleted_at_utc),
    CHECK (
        (lifecycle_state = 'active' AND deleted_at_utc IS NULL)
        OR (lifecycle_state = 'deleted' AND deleted_at_utc IS NOT NULL)
    ),
    FOREIGN KEY (personal_owner_actor_id)
        REFERENCES actors (actor_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE TABLE workspaces (
    workspace_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workspace_kind TEXT NOT NULL,
    lifecycle_state TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    deleted_at_utc TEXT,
    UNIQUE (tenant_id, workspace_id),
    CHECK (
        length(workspace_id) = 36
        AND substr(workspace_id, 1, 4) = 'wsp_'
        AND substr(workspace_id, 5) NOT GLOB '*[^0-9a-f]*'
    ),
    CHECK (workspace_kind IN ('personal', 'collaborative')),
    CHECK (lifecycle_state IN ('active', 'archived', 'deleted')),
    CHECK (
        created_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at_utc)
    ),
    CHECK (
        updated_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at_utc)
    ),
    CHECK (
        deleted_at_utc IS NULL
        OR deleted_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at_utc)
    ),
    CHECK (
        substr(created_at_utc, 1, 4) <> '0000'
        AND substr(created_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND substr(updated_at_utc, 1, 4) <> '0000'
        AND substr(updated_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND (
            deleted_at_utc IS NULL
            OR (
                substr(deleted_at_utc, 1, 4) <> '0000'
                AND substr(deleted_at_utc, 12, 2) BETWEEN '00' AND '23'
            )
        )
    ),
    CHECK (updated_at_utc >= created_at_utc),
    CHECK (deleted_at_utc IS NULL OR deleted_at_utc >= created_at_utc),
    CHECK (deleted_at_utc IS NULL OR updated_at_utc >= deleted_at_utc),
    CHECK (
        (lifecycle_state IN ('active', 'archived') AND deleted_at_utc IS NULL)
        OR (lifecycle_state = 'deleted' AND deleted_at_utc IS NOT NULL)
    ),
    FOREIGN KEY (tenant_id)
        REFERENCES tenants (tenant_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE UNIQUE INDEX ux_workspaces_one_personal_per_tenant
    ON workspaces (tenant_id)
    WHERE workspace_kind = 'personal';

CREATE INDEX ix_workspaces_tenant_state
    ON workspaces (tenant_id, lifecycle_state, workspace_id);

CREATE TABLE workspace_memberships (
    membership_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    role TEXT NOT NULL,
    membership_state TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    ended_at_utc TEXT,
    UNIQUE (workspace_id, actor_id),
    CHECK (
        length(membership_id) = 36
        AND substr(membership_id, 1, 4) = 'mbr_'
        AND substr(membership_id, 5) NOT GLOB '*[^0-9a-f]*'
    ),
    CHECK (role IN ('owner', 'admin', 'member', 'guest')),
    CHECK (membership_state IN ('active', 'suspended', 'left', 'revoked')),
    CHECK (
        created_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at_utc)
    ),
    CHECK (
        updated_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at_utc)
    ),
    CHECK (
        ended_at_utc IS NULL
        OR ended_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', ended_at_utc)
    ),
    CHECK (
        substr(created_at_utc, 1, 4) <> '0000'
        AND substr(created_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND substr(updated_at_utc, 1, 4) <> '0000'
        AND substr(updated_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND (
            ended_at_utc IS NULL
            OR (
                substr(ended_at_utc, 1, 4) <> '0000'
                AND substr(ended_at_utc, 12, 2) BETWEEN '00' AND '23'
            )
        )
    ),
    CHECK (updated_at_utc >= created_at_utc),
    CHECK (ended_at_utc IS NULL OR ended_at_utc >= created_at_utc),
    CHECK (ended_at_utc IS NULL OR updated_at_utc >= ended_at_utc),
    CHECK (
        (membership_state IN ('active', 'suspended') AND ended_at_utc IS NULL)
        OR (membership_state IN ('left', 'revoked') AND ended_at_utc IS NOT NULL)
    ),
    FOREIGN KEY (actor_id)
        REFERENCES actors (actor_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id, workspace_id)
        REFERENCES workspaces (tenant_id, workspace_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE INDEX ix_memberships_actor_state
    ON workspace_memberships (actor_id, membership_state, tenant_id, workspace_id);

CREATE INDEX ix_memberships_workspace_state
    ON workspace_memberships (tenant_id, workspace_id, membership_state, actor_id);

CREATE TABLE devices (
    device_id TEXT PRIMARY KEY,
    owner_actor_id TEXT NOT NULL,
    device_kind TEXT NOT NULL,
    lifecycle_state TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    last_seen_at_utc TEXT NOT NULL,
    retired_at_utc TEXT,
    CHECK (
        length(device_id) = 36
        AND substr(device_id, 1, 4) = 'dev_'
        AND substr(device_id, 5) NOT GLOB '*[^0-9a-f]*'
    ),
    CHECK (device_kind = 'windows_installation'),
    CHECK (lifecycle_state IN ('active', 'retired')),
    CHECK (
        created_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at_utc)
    ),
    CHECK (
        updated_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at_utc)
    ),
    CHECK (
        last_seen_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', last_seen_at_utc)
    ),
    CHECK (
        retired_at_utc IS NULL
        OR retired_at_utc IS strftime('%Y-%m-%dT%H:%M:%fZ', retired_at_utc)
    ),
    CHECK (
        substr(created_at_utc, 1, 4) <> '0000'
        AND substr(created_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND substr(updated_at_utc, 1, 4) <> '0000'
        AND substr(updated_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND substr(last_seen_at_utc, 1, 4) <> '0000'
        AND substr(last_seen_at_utc, 12, 2) BETWEEN '00' AND '23'
        AND (
            retired_at_utc IS NULL
            OR (
                substr(retired_at_utc, 1, 4) <> '0000'
                AND substr(retired_at_utc, 12, 2) BETWEEN '00' AND '23'
            )
        )
    ),
    CHECK (last_seen_at_utc >= created_at_utc),
    CHECK (updated_at_utc >= last_seen_at_utc),
    CHECK (retired_at_utc IS NULL OR retired_at_utc >= last_seen_at_utc),
    CHECK (retired_at_utc IS NULL OR updated_at_utc >= retired_at_utc),
    CHECK (
        (lifecycle_state = 'active' AND retired_at_utc IS NULL)
        OR (lifecycle_state = 'retired' AND retired_at_utc IS NOT NULL)
    ),
    FOREIGN KEY (owner_actor_id)
        REFERENCES actors (actor_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) STRICT, WITHOUT ROWID;

CREATE INDEX ix_devices_owner_state
    ON devices (owner_actor_id, lifecycle_state, device_id);

PRAGMA user_version = 1;
```

The migration runner inserts the following ledger operation inside the same transaction after the DDL succeeds, using bound parameters rather than string interpolation:

```sql
INSERT INTO schema_migrations (
    version,
    name,
    checksum_sha256,
    applied_at_utc,
    application_version
) VALUES (?, ?, ?, ?, ?);
```

The values for migration 0001 are version `1`, name `foundation`, the canonical migration-file SHA-256, the supplied UTC clock value, and the running Ascend application version.

## Bootstrap invariants

Task 7 performs the first-run bootstrap in one `BEGIN IMMEDIATE` transaction after migration 0001 is verified.

For a new local vault it creates exactly:

- one active actor;
- one active personal tenant whose `personal_owner_actor_id` is that actor;
- one active personal workspace owned by that tenant;
- one active `owner` membership linking that actor to that tenant/workspace; and
- one active `windows_installation` device owned by that actor.

Only the `owner` role and `active` states are reachable in v1. `organization`, `collaborative`, `admin`, `member`, `guest`, and non-active states are schema seams, not enabled product behavior.

The random device ID is first persisted atomically in a narrowly scoped local installation-identity file under Ascend's application-data directory. It contains no hardware identifier or credential. The same device ID is then used for database bootstrap. If bootstrap fails, the identity file is reused on retry; it is never regenerated merely because a database operation failed.

Repeated bootstrap with the same device ID must return the existing complete chain without inserting rows or changing timestamps. If the identity file is absent while any foundation row already exists, its device ID does not identify the sole expected device, or the chain is partial, duplicated, cross-tenant, non-personal, non-owner, non-active, or otherwise ambiguous, bootstrap fails visibly with `bootstrap_inconsistent`; it does not guess, repair, reparent, or delete data.

No ID or display value is derived from the Windows username, email, hostname, registry owner, hardware serial, MAC address, or provider account.

### Blocking installation-identity decision for Task 7

Before Task 7 implementation, OD-21 must separately specify and approve the installation-identity file's exact filename and application-data path, serialized format and validation limits, Windows ACL and inherited-permission requirements, atomic write/replace and crash-recovery behavior, and reparse-point/symlink handling. It must also define first-run creation, concurrent-process behavior, malformed or missing-file outcomes, backup/restore and cloned-vault handling, diagnostics redaction, and uninstall retention.

This audit remediation records the gate only. It does not select a filename, format, permission implementation, filesystem operation, dependency, or recovery policy, and it does not authorize Task 7 implementation.

The concrete proposed contract is now in `docs/INSTALLATION-IDENTITY-PROPOSAL.md` (2026-09-05). It remains pending separate founder approval; Task 6 completion does not resolve OD-21.

## Ownership and visibility contract for later records

Migration 0001 has no user-owned content table. Every later owned/shareable record must nevertheless follow this approved shape from its first migration:

- mandatory `tenant_id` and `workspace_id` forming one validated scope, with a composite foreign key to `(tenant_id, workspace_id)` rather than two unrelated IDs;
- an ownership kind of actor-owned personal, workspace-owned, or tenant-owned;
- `owner_actor_id` required only for actor-owned personal records;
- creator/acting actor and device/client provenance;
- created/updated UTC timestamps and an explicit deletion/gravestone policy; and
- private-by-default authorization enforced below the UI.

The meanings are deliberately distinct:

| Meaning            | Ownership and visibility rule                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal           | Actor-owned inside that actor's personal tenant/workspace. Only the owning actor can access it unless a later explicit grant says otherwise.                                  |
| Explicitly shared  | A bounded visibility grant over an existing record, never an ownership transfer. Revoking the grant leaves original ownership unchanged.                                      |
| Workspace-owned    | Owned by the tenant through one workspace and visible only under active membership plus the later record policy; no member owns it merely by creating it.                     |
| Organization-owned | A tenant-owned/workspace-scoped record whose tenant is an organization. Organization retention/portability rules apply; it never silently becomes a member's personal record. |

Joining an organization cannot change ownership or visibility of personal data. Personal contexts—including family, health, finances, learning, habits, goals, and private relationships—do not inherit work or organization access.

## Roles and authorization semantics

- `owner`: can administer the workspace on behalf of its owning tenant under later approved policy. The membership role does not itself own records. The personal bootstrap actor is the only reachable v1 owner.
- `admin`, `member`, and `guest`: reserved role values for later approved organization behavior; migration 0001 creates no such membership.
- A role grants nothing by itself. Authorization requires the active actor, active membership, tenant/workspace match, requested operation, record ownership/visibility, and later policy checks.
- Tenant administration is not encoded as a permanent actor property and is not implemented in migration 0001.
- A device has no independent permission. It acts only with its owner actor's current authorized context.

## Lifecycle, deletion, and portability

- Foundation IDs never change and repository code never updates primary keys.
- Foreign keys use `ON UPDATE RESTRICT` and `ON DELETE RESTRICT`; migration 0001 has no cascade path and cannot silently orphan, move, or transfer ownership.
- Actor, tenant, and workspace logical deletion preserves only their non-content identity/relationship row and `deleted_at_utc` gravestone state.
- Membership `left`/`revoked` and device `retired` states preserve relationship history without granting access.
- State transitions and timestamps occur in one transaction. Cross-row rules—such as denying an active workspace under a deleted tenant—are enforced by the scoped data-access layer and adversarial tests because SQLite `CHECK` constraints cannot query another table.
- Uninstall continues to preserve the application-data directory. A future explicit “destroy local vault” operation must stop the engine, close SQLite, and separately prove deletion of the database, WAL/SHM files, backups, media, indexes, and identity file; migration 0001 does not implement it.
- Leaving a future organization ends the organization workspace membership. It does not delete the actor or personal tenant/workspace, move organization-owned rows into personal scope, or expose personal rows to the organization.

## Future cloud identity mapping

Cloud identity does not belong in `actors`. A later approved migration may add a separate mapping from `actor_id` to an issuer/provider and immutable external subject, with issuer-plus-subject uniqueness. Linking or unlinking an external identity never replaces the actor ID or rewrites owned records.

Email addresses, provider account IDs, Windows accounts, and organization memberships remain aliases/relationships, not stable actor identity.

## Migration-runner behavior required for Task 6

- Discover numbered bundled migrations in strict ascending order with no duplicate or missing version.
- Reject a BOM/non-UTF-8 migration, canonicalize line endings/final LF exactly as specified above, and hash those canonical bytes with SHA-256 before opening a write transaction.
- On a new database, require `user_version = 0` and no application tables.
- Before every migration, compare all previously recorded names/checksums with the bundled files.
- Refuse a database whose `user_version`, ledger maximum, ledger sequence, checksum, or expected schema objects disagree.
- Refuse any database version newer than the running application; never attempt a downgrade.
- Apply one migration and its ledger row atomically under `BEGIN IMMEDIATE`; rollback every schema and ledger change on failure.
- After application, require `PRAGMA user_version`, the ledger maximum, and the bundled maximum to agree.
- Run `PRAGMA foreign_key_check` and `PRAGMA quick_check`; any row/result other than success is a visible failure.
- Never continue after an unknown, corrupt, partially applied, or tampered migration.
- Log only migration version, approved name, checksum, duration, and typed outcome. Never log SQL parameters or user content.

## Required tests before implementation can be called complete

### Task 6 — migration runner

- A new temporary database applies migration 0001 once and has exactly the approved tables, indexes, strict modes, foreign keys, and `user_version`.
- A second run is a no-op and does not change the ledger row or schema.
- A changed checksum, renamed migration, missing version, duplicate version, future version, user-version/ledger mismatch, missing schema object, and failed integrity/foreign-key check each fail visibly without writes.
- An injected DDL failure rolls back both schema and ledger changes.
- A second concurrent writer returns the bounded busy outcome; it does not hang or loop indefinitely.
- Wrong SQLite value types, malformed typed IDs, invalid enum states, noncanonical or impossible timestamps (including year `0000` and hour `24`), and inconsistent lifecycle timestamps are rejected by constraints.
- Foreign-key and composite tenant/workspace mismatches are rejected.

### Task 7 — personal bootstrap

- Empty state creates exactly one actor, personal tenant, personal workspace, owner membership, and device with the expected links and supplied timestamp.
- Repeating bootstrap with the same device ID is idempotent and preserves IDs/timestamps.
- A partial, duplicate, wrong-prefix, cross-tenant, wrong-role, non-active, missing-identity-file, or identity-file/device mismatch fails and rolls back without “repair.”
- A personal tenant cannot have a second personal owner or second personal workspace.
- Bootstrap stores no Windows username, email, hostname, serial, MAC address, provider ID, credential, or real user content.

### Task 8 — scoped data access

- Every protected repository call requires a typed actor/tenant/workspace context and active matching membership.
- Cross-tenant and cross-workspace reads/writes are denied even when a valid ID exists.
- An actor, device, membership, provider/external, or future memory-entity/context ID cannot be accepted as a tenant or workspace ID.
- Role changes affect membership rows, never actor identity.
- Direct SQLite opens outside the one engine data-access boundary are rejected structurally.

## Security review

- The schema carries no real content and remains under OD-03's synthetic-only plaintext restriction.
- Identity/account tables are separated from future memory entities/contexts, preventing a client, company, family member, goal, or project from becoming an authorization principal.
- Type-prefixed IDs, composite workspace foreign keys, strict tables, no rowids, immutable keys, and restrictive deletion reduce confused-deputy and cross-scope mistakes.
- Actors and devices are intentionally global identity records; access to tenant/workspace data always comes from an active membership, never actor/device ownership alone.
- The renderer, models, workers, imports, providers, and MCP/API clients receive no direct database handle.
- No credential, external identity, provider connection, screenshot, sensitive-domain, or agent authority is prebuilt into migration 0001.
- Plain SQLite remains readable by same-user malware and from accessible backups. No real-data testing or encryption claim is allowed.
- Migration checksums detect accidental drift, corruption, and mismatched application/database versions; they are not signatures and cannot defeat a same-user attacker who can alter both the application files and database.
- A byte-for-byte copy of both the complete local vault and its installation-identity file is indistinguishable from the original while Ascend remains local-only. Migration 0001 makes no clone-detection claim; future multi-device synchronization must specify device registration and collision handling before cloud use.

## Approval record

- Proposed schema: Written on 2026-08-05
- SQLite/source review: SQLite 3.53.1 observed; official STRICT, WITHOUT ROWID, foreign-key, transaction, and PRAGMA behavior reviewed on 2026-08-05
- Security review: Task 6 implementation reviewed; see `docs/reviews/STORAGE-MIGRATIONS-2026-09-05.md`. Tasks 7-8 retain their own reviews.
- Focused test list: Task 6 has 49 passing migration/constraint tests. Tasks 7-8 are not implemented.
- Founder decision: Approved 2026-09-05: "Go ahead and do the development" in response to the explicit storage-specification approval request. Productivity/habit improvement is the leading product priority, alongside cross-app use and meeting notes.

Recorded approval scope:

> Approved: `docs/DATA-MODEL.md` migration-0001 specification. Proceed with Tasks 6-8 using synthetic data only, one task at a time, and test-driven development. Do not add real data, encryption claims, integrations, memory/entity tables, screenshots, models, agents, organization features, cloud resources, credentials, outside testing, publishing, or deployment through this approval.
