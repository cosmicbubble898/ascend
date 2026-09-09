CREATE TABLE activity_evidence (
 evidence_id TEXT PRIMARY KEY CHECK(evidence_id GLOB 'evd_[0-9a-f]*' AND length(evidence_id)=36),
 tenant_id TEXT NOT NULL, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL, device_id TEXT NOT NULL,
 observed_at_ms INTEGER NOT NULL CHECK(observed_at_ms>=0), app TEXT NOT NULL, monitor TEXT NOT NULL,
 service TEXT NOT NULL, surface TEXT NOT NULL CHECK(surface IN ('document','communication','meeting','development','planning','research','media','system','other')),
 summary TEXT NOT NULL, project_hint TEXT NOT NULL, task_hint TEXT NOT NULL,
 category_hint TEXT NOT NULL CHECK(category_hint IN ('Work','Communication','Learning','Personal','Uncategorized')),
 confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 1000), domain TEXT NOT NULL, audio_active INTEGER NOT NULL CHECK(audio_active IN (0,1)),
 source_model TEXT NOT NULL, created_at_ms INTEGER NOT NULL,
 FOREIGN KEY(workspace_id,actor_id) REFERENCES workspace_memberships(workspace_id,actor_id),
 FOREIGN KEY(device_id) REFERENCES devices(device_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX ix_activity_evidence_scope_time ON activity_evidence(tenant_id,workspace_id,actor_id,observed_at_ms);
CREATE TABLE screen_analysis_runs (
 run_id TEXT PRIMARY KEY CHECK(run_id GLOB 'run_[0-9a-f]*' AND length(run_id)=36),
 tenant_id TEXT NOT NULL, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 observed_at_ms INTEGER NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('success','error')), latency_ms INTEGER NOT NULL,
 input_tokens INTEGER NOT NULL CHECK(input_tokens>=0), output_tokens INTEGER NOT NULL CHECK(output_tokens>=0), error_code TEXT NOT NULL,
 FOREIGN KEY(workspace_id,actor_id) REFERENCES workspace_memberships(workspace_id,actor_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX ix_screen_runs_scope_time ON screen_analysis_runs(tenant_id,workspace_id,actor_id,observed_at_ms);
PRAGMA user_version = 4;
