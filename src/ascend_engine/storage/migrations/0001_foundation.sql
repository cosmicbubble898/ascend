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
