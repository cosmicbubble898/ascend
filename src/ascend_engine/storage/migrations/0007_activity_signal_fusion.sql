CREATE TABLE activity_capture_signals (
 segment_id TEXT PRIMARY KEY REFERENCES activity_segments(segment_id) ON DELETE CASCADE,
 tenant_id TEXT NOT NULL, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL, device_id TEXT NOT NULL,
 window_class TEXT NOT NULL CHECK(length(window_class)<=120), aumid TEXT NOT NULL CHECK(length(aumid)<=160),
 uia_domain TEXT NOT NULL CHECK(length(uia_domain)<=253), service TEXT NOT NULL CHECK(length(service)<=100),
 surface TEXT NOT NULL CHECK(surface IN ('document','communication','meeting','development','planning','research','media','system','other')),
 context_summary TEXT NOT NULL CHECK(length(context_summary)<=240),
 context_confidence INTEGER NOT NULL CHECK(context_confidence BETWEEN 0 AND 1000),
 context_source TEXT NOT NULL CHECK(length(context_source)<=80),
 audio_output INTEGER NOT NULL CHECK(audio_output IN (0,1)), audio_input INTEGER NOT NULL CHECK(audio_input IN (0,1)),
 media_title TEXT NOT NULL CHECK(length(media_title)<=160),
 FOREIGN KEY(workspace_id,actor_id) REFERENCES workspace_memberships(workspace_id,actor_id),
 FOREIGN KEY(device_id) REFERENCES devices(device_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX ix_activity_signals_scope ON activity_capture_signals(tenant_id,workspace_id,actor_id);
ALTER TABLE screen_analysis_runs ADD COLUMN evidence_committed INTEGER NOT NULL DEFAULT 0 CHECK(evidence_committed IN (0,1));
ALTER TABLE screen_analysis_runs ADD COLUMN image_disposition TEXT NOT NULL DEFAULT 'not_captured' CHECK(image_disposition IN ('pending','discarded_after_commit','not_captured','legacy_discarded'));
ALTER TABLE screen_analysis_runs ADD COLUMN disposed_at_ms INTEGER NOT NULL DEFAULT 0 CHECK(disposed_at_ms>=0);
UPDATE screen_analysis_runs SET evidence_committed=1,image_disposition='legacy_discarded',disposed_at_ms=observed_at_ms WHERE status='success';
UPDATE screen_analysis_runs SET image_disposition='legacy_discarded',disposed_at_ms=observed_at_ms WHERE status='error' AND screenshot_captured=1;
PRAGMA user_version = 7;
