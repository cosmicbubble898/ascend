ALTER TABLE activity_evidence ADD COLUMN evidence_kind TEXT NOT NULL DEFAULT 'vision' CHECK(evidence_kind IN ('vision','activity_llm'));
ALTER TABLE activity_evidence ADD COLUMN segment_id TEXT NOT NULL DEFAULT '' CHECK(segment_id='' OR (segment_id GLOB 'seg_[0-9a-f]*' AND length(segment_id)=36));
CREATE INDEX ix_activity_evidence_segment ON activity_evidence(tenant_id,workspace_id,actor_id,segment_id,evidence_kind);
UPDATE productivity_settings SET value='1440' WHERE name='visionDailyCap' AND value='300';
PRAGMA user_version = 8;
