CREATE TABLE activity_segments (
    segment_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES actors(actor_id),
    device_id TEXT NOT NULL REFERENCES devices(device_id),
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    app TEXT NOT NULL,
    title TEXT NOT NULL,
    monitor TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('active', 'idle')),
    CHECK (end_ms > start_ms AND end_ms - start_ms <= 60000),
    CHECK (length(app) <= 120 AND length(title) <= 300 AND length(monitor) <= 80),
    FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces(tenant_id, workspace_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX ix_activity_scope_time ON activity_segments(tenant_id, workspace_id, actor_id, start_ms);
CREATE TABLE activity_corrections (
    segment_id TEXT PRIMARY KEY REFERENCES activity_segments(segment_id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('Work', 'Communication', 'Learning', 'Personal', 'Uncategorized')),
    project TEXT NOT NULL CHECK (length(project) <= 100)
) STRICT, WITHOUT ROWID;
CREATE TABLE productivity_settings (
    tenant_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES actors(actor_id),
    name TEXT NOT NULL,
    value TEXT NOT NULL CHECK (length(value) <= 12000),
    PRIMARY KEY (tenant_id, workspace_id, actor_id, name),
    FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces(tenant_id, workspace_id)
) STRICT, WITHOUT ROWID;
PRAGMA user_version = 2;
