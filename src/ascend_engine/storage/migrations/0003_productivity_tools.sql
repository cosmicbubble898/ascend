CREATE TABLE activity_context (
    segment_id TEXT PRIMARY KEY REFERENCES activity_segments(segment_id) ON DELETE CASCADE,
    project TEXT NOT NULL CHECK (length(project) <= 100),
    task TEXT NOT NULL CHECK (length(task) <= 100),
    planning TEXT NOT NULL CHECK (planning IN ('planned', 'unplanned', 'unspecified')),
    source TEXT NOT NULL CHECK (length(source) <= 160)
) STRICT, WITHOUT ROWID;
CREATE TABLE productivity_plans (
    plan_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    actor_id TEXT NOT NULL REFERENCES actors(actor_id),
    day_ms INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
    project TEXT NOT NULL CHECK (length(project) <= 100),
    minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 480),
    completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
    FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces(tenant_id, workspace_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX ix_plans_scope_day ON productivity_plans(tenant_id, workspace_id, actor_id, day_ms);
PRAGMA user_version = 3;
