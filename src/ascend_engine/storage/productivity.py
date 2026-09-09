"""Scoped activity DAL backed only by current-user encrypted snapshots."""

import json
import msvcrt
import os
import sqlite3
import stat
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Self
from uuid import uuid4

from ascend_engine.productivity.classification import classify
from ascend_engine.productivity.fusion import fuse
from ascend_engine.productivity.model import CATEGORIES
from ascend_engine.storage.migration_runner import migrate
from ascend_engine.storage.windows_protection import protect

MAGIC = b"ASCEND-ACTIVITY-1\x00"
MAX_BYTES = 64 * 1024 * 1024
SETTINGS_DEFAULTS: dict[str, Any] = {
    "details": True,
    "excluded": [],
    "rules": {},
    "contextRules": [],
    "pausedUntil": 0,
    "goalMinutes": 120,
    "breakMinutes": 60,
    "focus": {},
    "aiModel": "",
    "notifiedFocus": "",
    "breakAfter": 0,
    "visionEnabled": True,
    "visionDailyCap": 1440,
    "activityAnalysisEnabled": True,
    "profileName": "",
    "profileRole": "",
    "profileNotes": "",
}


def _safe(path: Path) -> None:
    for item in [*reversed(path.parents), path]:
        try:
            info = item.lstat()
        except FileNotFoundError:
            continue
        if info.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise OSError("vault_path_unsafe")
        if item.is_file() and info.st_nlink != 1:
            raise OSError("vault_path_unsafe")


def _id(prefix: str) -> str:
    return prefix + "_" + uuid4().hex


class ProductivityStore:
    """Own one connection, one stable personal scope, and one writer lock."""

    def __init__(self, path: Path) -> None:
        self.path = path.absolute()
        self.closed = False
        _safe(self.path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        _safe(self.path)
        lock_path = self.path.with_suffix(".lock")
        _safe(lock_path)
        self.lock = lock_path.open("a+b")
        self.connection = sqlite3.connect(":memory:")
        try:
            if lock_path.stat().st_size == 0:
                self.lock.write(b"0")
                self.lock.flush()
            self.lock.seek(0)
            msvcrt.locking(self.lock.fileno(), msvcrt.LK_NBLCK, 1)
            self.connection.execute("PRAGMA temp_store = MEMORY")
            self.connection.execute("PRAGMA journal_mode = MEMORY")
            existed = self.path.exists()
            if existed:
                with self.path.open("rb") as source:
                    encrypted = source.read(MAX_BYTES + 1)
                if len(encrypted) > MAX_BYTES or not encrypted.startswith(MAGIC):
                    raise ValueError("vault_invalid")
                plaintext = protect(encrypted[len(MAGIC) :], decrypt=True)
                if len(plaintext) > MAX_BYTES or not plaintext.startswith(b"SQLite format 3\x00"):
                    raise ValueError("vault_invalid")
                self.connection.deserialize(plaintext)
            stamp = datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            migrate(self.connection, applied_at_utc=stamp, application_version="0.0.0")
            self.scope = self._bootstrap(stamp, existed)
            self.connection.row_factory = sqlite3.Row
            if not existed:
                self.save()
        except BaseException:
            self.connection.close()
            self.lock.close()
            self.closed = True
            raise

    def _bootstrap(self, stamp: str, existed: bool) -> tuple[str, str, str, str]:
        existing = self.connection.execute(
            "SELECT a.actor_id, t.tenant_id, w.workspace_id, d.device_id FROM actors a "
            "JOIN tenants t ON t.personal_owner_actor_id = a.actor_id "
            "JOIN workspaces w ON w.tenant_id = t.tenant_id "
            "JOIN workspace_memberships m ON m.workspace_id = w.workspace_id AND m.actor_id = a.actor_id "
            "JOIN devices d ON d.owner_actor_id = a.actor_id "
            "WHERE a.lifecycle_state='active' AND t.lifecycle_state='active' AND t.tenant_kind='personal' "
            "AND w.lifecycle_state='active' AND w.workspace_kind='personal' "
            "AND m.membership_state='active' AND m.role='owner' AND d.lifecycle_state='active'"
        ).fetchall()
        if len(existing) == 1:
            row = existing[0]
            return str(row[0]), str(row[1]), str(row[2]), str(row[3])
        if (
            existed
            or existing
            or self.connection.execute("SELECT count(*) FROM actors").fetchone()[0]
        ):
            raise ValueError("vault_identity_inconsistent")
        actor, tenant, workspace, device = _id("act"), _id("ten"), _id("wsp"), _id("dev")
        with self.connection:
            self.connection.execute(
                "INSERT INTO actors VALUES (?, 'active', ?, ?, NULL)", (actor, stamp, stamp)
            )
            self.connection.execute(
                "INSERT INTO tenants VALUES (?, 'personal', ?, 'active', ?, ?, NULL)",
                (tenant, actor, stamp, stamp),
            )
            self.connection.execute(
                "INSERT INTO workspaces VALUES (?, ?, 'personal', 'active', ?, ?, NULL)",
                (workspace, tenant, stamp, stamp),
            )
            self.connection.execute(
                "INSERT INTO workspace_memberships VALUES (?, ?, ?, ?, 'owner', 'active', ?, ?, NULL)",
                (_id("mbr"), tenant, workspace, actor, stamp, stamp),
            )
            self.connection.execute(
                "INSERT INTO devices VALUES (?, ?, 'windows_installation', 'active', ?, ?, ?, NULL)",
                (device, actor, stamp, stamp, stamp),
            )
        return actor, tenant, workspace, device

    @property
    def _where(self) -> tuple[str, str, str]:
        actor, tenant, workspace, _ = self.scope
        return tenant, workspace, actor

    def save(self) -> None:
        self.connection.commit()
        data = self.connection.serialize()
        if len(data) > MAX_BYTES - 4096:
            raise OSError("vault_full")
        encrypted = MAGIC + protect(data)
        _safe(self.path)
        temporary = self.path.with_name("activity-" + uuid4().hex + ".pending")
        try:
            with temporary.open("xb") as output:
                output.write(encrypted)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, self.path)
        finally:
            temporary.unlink(missing_ok=True)

    def latest_end(self) -> int:
        row = self.connection.execute(
            "SELECT coalesce(max(end_ms), 0) FROM activity_segments WHERE tenant_id=? AND workspace_id=? AND actor_id=?",
            self._where,
        ).fetchone()
        return int(row[0])

    def settings(self) -> dict[str, Any]:
        values: dict[str, Any] = json.loads(json.dumps(SETTINGS_DEFAULTS))
        for row in self.connection.execute(
            "SELECT name, value FROM productivity_settings WHERE tenant_id=? AND workspace_id=? AND actor_id=?",
            self._where,
        ):
            if row["name"] in values:
                values[row["name"]] = json.loads(row["value"])
        return values

    def set_setting(self, name: str, value: Any) -> None:
        if name not in SETTINGS_DEFAULTS:
            raise ValueError("invalid_setting")
        if len(json.dumps(value)) > 12000:
            raise ValueError("setting_too_large")
        self.connection.execute(
            "INSERT INTO productivity_settings VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT (tenant_id, workspace_id, actor_id, name) DO UPDATE SET value=excluded.value",
            (*self._where, name, json.dumps(value)),
        )
        self.save()

    def set_rule(self, app: str, category: str) -> None:
        if not app or len(app) > 120 or category not in CATEGORIES:
            raise ValueError("invalid_rule")
        rules = self.settings()["rules"]
        if app not in rules and len(rules) >= 100:
            raise ValueError("too_many_rules")
        rules[app] = category
        self.set_setting("rules", rules)

    def add_segment(
        self,
        start: int,
        end: int,
        app: str,
        title: str,
        monitor: str,
        kind: str,
        signals: dict[str, Any] | None = None,
    ) -> str:
        actor, tenant, workspace, device = self.scope
        identifier = _id("seg")
        self.connection.execute(
            "INSERT INTO activity_segments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                identifier,
                tenant,
                workspace,
                actor,
                device,
                start,
                end,
                app[:120],
                title[:300],
                monitor[:80],
                kind,
            ),
        )
        if kind == "active" and signals:
            self.connection.execute(
                "INSERT INTO activity_capture_signals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    identifier,
                    tenant,
                    workspace,
                    actor,
                    device,
                    str(signals.get("window_class", ""))[:120],
                    str(signals.get("aumid", ""))[:160],
                    str(signals.get("uia_domain", ""))[:253],
                    str(signals.get("service", ""))[:100],
                    str(signals.get("surface", "other")),
                    str(signals.get("context_summary", ""))[:240],
                    max(0, min(1000, int(signals.get("context_confidence", 0)))),
                    str(signals.get("context_source", "windows_metadata"))[:80],
                    int(bool(signals.get("audio_output"))),
                    int(bool(signals.get("audio_input"))),
                    str(signals.get("media_title", ""))[:160],
                ),
            )
        return identifier

    def rows(self, start: int, end: int) -> list[dict[str, Any]]:
        settings = self.settings()
        output = []
        for row in self.connection.execute(
            "SELECT s.*, c.category, c.project, x.project AS context_project, x.task, x.planning, x.source, "
            "g.window_class,g.aumid,g.uia_domain,g.service,g.surface,g.context_summary,g.context_confidence,g.context_source,g.audio_output,g.audio_input,g.media_title "
            "FROM activity_segments s "
            "LEFT JOIN activity_corrections c ON c.segment_id=s.segment_id "
            "LEFT JOIN activity_context x ON x.segment_id=s.segment_id "
            "LEFT JOIN activity_capture_signals g ON g.segment_id=s.segment_id "
            "WHERE s.tenant_id=? AND s.workspace_id=? AND s.actor_id=? AND s.end_ms>? AND s.start_ms<? "
            "ORDER BY s.start_ms, s.segment_id",
            (*self._where, start, end),
        ):
            classified = classify(row["app"], row["title"], settings)
            evidence = self.connection.execute(
                "SELECT * FROM activity_evidence WHERE tenant_id=? AND workspace_id=? AND actor_id=? "
                "AND evidence_kind='vision' AND observed_at_ms>=? AND observed_at_ms<? AND app=? AND monitor=? "
                "ORDER BY observed_at_ms DESC LIMIT 1",
                (
                    *self._where,
                    row["start_ms"],
                    row["end_ms"],
                    row["app"],
                    row["monitor"],
                ),
            ).fetchone()
            activity_evidence = self.connection.execute(
                "SELECT * FROM activity_evidence WHERE tenant_id=? AND workspace_id=? AND actor_id=? "
                "AND evidence_kind='activity_llm' AND segment_id=? ORDER BY created_at_ms DESC LIMIT 1",
                (*self._where, row["segment_id"]),
            ).fetchone()
            signal_keys = (
                "window_class",
                "aumid",
                "uia_domain",
                "service",
                "surface",
                "context_summary",
                "context_confidence",
                "context_source",
                "audio_output",
                "audio_input",
                "media_title",
            )
            signals = {key: row[key] for key in signal_keys}
            fused = fuse(
                classified,
                signals,
                dict(evidence) if evidence else None,
                dict(activity_evidence) if activity_evidence else None,
            )
            output.append(
                {
                    "id": row["segment_id"],
                    "start": max(start, row["start_ms"]),
                    "end": min(end, row["end_ms"]),
                    "app": row["app"],
                    "title": row["title"],
                    "monitor": row["monitor"],
                    "kind": row["kind"],
                    "category": row["category"] or fused["category"],
                    "reason": (row["source"] or "Manual correction")
                    if row["category"]
                    else (fused["reason"]),
                    "project": row["project"]
                    if row["project"] is not None
                    else (
                        row["context_project"]
                        if row["context_project"] is not None
                        else (fused["project"])
                    ),
                    "task": row["task"] if row["task"] is not None else (fused["task"]),
                    "planning": row["planning"]
                    if row["planning"] is not None
                    else classified["planning"],
                    "corrected": row["category"] is not None,
                    "service": fused["service"],
                    "surface": fused["surface"],
                    "visionSummary": fused["summary"],
                    "visionConfidence": evidence["confidence"] if evidence else 0,
                    "analysisConfidence": (
                        activity_evidence["confidence"] * 10
                        if activity_evidence and 0 < activity_evidence["confidence"] <= 100
                        else activity_evidence["confidence"]
                        if activity_evidence
                        else 0
                    ),
                    "contextConfidence": fused["confidence"],
                    "domain": fused["domain"],
                    "audioActive": fused["audioOutput"] or fused["audioInput"],
                    "audioOutput": fused["audioOutput"],
                    "audioInput": fused["audioInput"],
                    "windowClass": row["window_class"] or "",
                    "aumid": row["aumid"] or "",
                    "evidenceSource": fused["evidenceSource"],
                }
            )
        return output

    def add_vision_result(
        self,
        observed: int,
        app: str,
        monitor: str,
        result: dict[str, Any],
        audio_active: bool,
        latency: int,
        run_id: str | None = None,
        evidence_id: str | None = None,
    ) -> str:
        actor, tenant, workspace, device = self.scope
        evidence_id, run_id = evidence_id or _id("evd"), run_id or _id("run")
        existing = self.connection.execute(
            "SELECT status,evidence_committed,image_disposition FROM screen_analysis_runs "
            "WHERE run_id=? AND tenant_id=? AND workspace_id=? AND actor_id=?",
            (run_id, *self._where),
        ).fetchone()
        if existing is not None:
            if tuple(existing) != ("success", 1, "pending"):
                raise OSError("vision_receipt_conflict")
            self.save()
            return run_id
        self.connection.execute(
            "INSERT INTO activity_evidence (evidence_id,tenant_id,workspace_id,actor_id,device_id,observed_at_ms,app,monitor,service,surface,summary,project_hint,task_hint,category_hint,confidence,domain,audio_active,source_model,created_at_ms,evidence_kind,segment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                evidence_id,
                tenant,
                workspace,
                actor,
                device,
                observed,
                app[:120],
                monitor[:80],
                result["service"],
                result["surface"],
                result["summary"],
                result["project_hint"],
                result["task_hint"],
                result["category_hint"],
                result["confidence"],
                "",
                int(audio_active),
                result["model"],
                int(datetime.now(UTC).timestamp() * 1000),
                "vision",
                "",
            ),
        )
        self.connection.execute(
            "INSERT INTO screen_analysis_runs (run_id,tenant_id,workspace_id,actor_id,observed_at_ms,provider,model,status,latency_ms,input_tokens,output_tokens,error_code,screenshot_captured,evidence_committed,image_disposition,disposed_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                run_id,
                tenant,
                workspace,
                actor,
                observed,
                "anthropic_vision",
                result["model"],
                "success",
                latency,
                result["input_tokens"],
                result["output_tokens"],
                "",
                1,
                1,
                "pending",
                0,
            ),
        )
        self.save()
        receipt = self.connection.execute(
            "SELECT evidence_committed,image_disposition FROM screen_analysis_runs WHERE run_id=? AND tenant_id=? AND workspace_id=? AND actor_id=?",
            (run_id, *self._where),
        ).fetchone()
        if receipt is None or tuple(receipt) != (1, "pending"):
            raise OSError("vision_receipt_unconfirmed")
        return run_id

    def add_vision_error(
        self,
        observed: int,
        error: str,
        latency: int,
        captured: bool,
        run_id: str | None = None,
    ) -> str:
        tenant, workspace, actor = self._where
        run_id = run_id or _id("run")
        existing = self.connection.execute(
            "SELECT status,evidence_committed,image_disposition FROM screen_analysis_runs "
            "WHERE run_id=? AND tenant_id=? AND workspace_id=? AND actor_id=?",
            (run_id, *self._where),
        ).fetchone()
        expected_disposition = "pending" if captured else "not_captured"
        if existing is not None:
            if tuple(existing) != ("error", 0, expected_disposition):
                raise OSError("vision_receipt_conflict")
            self.save()
            return run_id
        self.connection.execute(
            "INSERT INTO screen_analysis_runs (run_id,tenant_id,workspace_id,actor_id,observed_at_ms,provider,model,status,latency_ms,input_tokens,output_tokens,error_code,screenshot_captured,evidence_committed,image_disposition,disposed_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                run_id,
                tenant,
                workspace,
                actor,
                observed,
                "anthropic_vision",
                "claude-haiku-4-5-20251001",
                "error",
                latency,
                0,
                0,
                error[:80],
                int(captured),
                0,
                "pending" if captured else "not_captured",
                0,
            ),
        )
        self.save()
        if not self.connection.execute(
            "SELECT 1 FROM screen_analysis_runs WHERE run_id=? AND tenant_id=? AND workspace_id=? AND actor_id=?",
            (run_id, *self._where),
        ).fetchone():
            raise OSError("vision_receipt_unconfirmed")
        return run_id

    def confirm_image_discarded(self, run_id: str, disposed_at: int) -> None:
        current = self.connection.execute(
            "SELECT image_disposition FROM screen_analysis_runs WHERE run_id=? "
            "AND tenant_id=? AND workspace_id=? AND actor_id=?",
            (run_id, *self._where),
        ).fetchone()
        if current is not None and current[0] == "discarded_after_commit":
            self.save()
            return
        if (
            self.connection.execute(
                "UPDATE screen_analysis_runs SET image_disposition='discarded_after_commit',disposed_at_ms=? "
                "WHERE run_id=? AND tenant_id=? AND workspace_id=? AND actor_id=? AND screenshot_captured=1 AND image_disposition='pending'",
                (disposed_at, run_id, *self._where),
            ).rowcount
            != 1
        ):
            raise OSError("vision_disposal_unconfirmed")
        self.save()

    def vision_usage(self, start: int, end: int) -> dict[str, int]:
        row = self.connection.execute(
            "SELECT count(*),coalesce(sum(input_tokens),0),coalesce(sum(output_tokens),0) FROM screen_analysis_runs WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND provider IN ('anthropic','anthropic_vision') AND observed_at_ms>=? AND observed_at_ms<?",
            (*self._where, start, end),
        ).fetchone()
        return {"requests": int(row[0]), "inputTokens": int(row[1]), "outputTokens": int(row[2])}

    def vision_log(self) -> dict[str, Any]:
        total = self.connection.execute(
            "SELECT count(*),coalesce(sum(screenshot_captured),0),coalesce(sum(status='success'),0),coalesce(sum(status='error'),0),coalesce(sum(input_tokens),0),coalesce(sum(output_tokens),0) FROM screen_analysis_runs WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND provider IN ('anthropic','anthropic_vision')",
            self._where,
        ).fetchone()
        entries = [
            dict(row)
            for row in self.connection.execute(
                "SELECT observed_at_ms AS observedAt,status,model,latency_ms AS latencyMs,input_tokens AS inputTokens,output_tokens AS outputTokens,error_code AS errorCode,screenshot_captured AS screenshotCaptured,evidence_committed AS evidenceCommitted,image_disposition AS imageDisposition,disposed_at_ms AS disposedAt FROM screen_analysis_runs WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND provider IN ('anthropic','anthropic_vision') ORDER BY observed_at_ms DESC LIMIT 100",
                self._where,
            )
        ]
        input_tokens, output_tokens = int(total[4]), int(total[5])
        return {
            "attempts": int(total[0]),
            "screenshots": int(total[1]),
            "successful": int(total[2]),
            "failed": int(total[3]),
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "estimatedUsd": round(input_tokens / 1_000_000 + output_tokens * 5 / 1_000_000, 6),
            "entries": entries,
        }

    def activity_analysis_candidates(self, since: int, limit: int = 12) -> list[dict[str, Any]]:
        if not 1 <= limit <= 12:
            raise ValueError("invalid_analysis_limit")
        return [
            dict(row)
            for row in self.connection.execute(
                "SELECT s.segment_id AS id,s.app,s.title,s.monitor,"
                "coalesce(g.uia_domain,'') AS domain,coalesce(g.service,'') AS service,"
                "coalesce(g.surface,'other') AS surface,coalesce(g.audio_output,0) AS audio_output,"
                "coalesce(g.audio_input,0) AS audio_input,coalesce(v.summary,'') AS vision_summary,"
                "coalesce(v.category_hint,'') AS vision_category,coalesce(v.confidence,0) AS vision_confidence "
                "FROM activity_segments s "
                "LEFT JOIN activity_capture_signals g ON g.segment_id=s.segment_id "
                "LEFT JOIN activity_corrections c ON c.segment_id=s.segment_id "
                "LEFT JOIN activity_evidence a ON a.segment_id=s.segment_id AND a.evidence_kind='activity_llm' "
                "LEFT JOIN activity_evidence v ON v.evidence_kind='vision' AND v.tenant_id=s.tenant_id "
                "AND v.workspace_id=s.workspace_id AND v.actor_id=s.actor_id AND v.app=s.app AND v.monitor=s.monitor "
                "AND v.observed_at_ms>=s.start_ms AND v.observed_at_ms<s.end_ms "
                "WHERE s.tenant_id=? AND s.workspace_id=? AND s.actor_id=? AND s.kind='active' "
                "AND s.end_ms>=? AND s.title<>'' AND c.segment_id IS NULL AND a.evidence_id IS NULL "
                "ORDER BY s.start_ms DESC LIMIT ?",
                (*self._where, since, limit),
            )
        ]

    def add_activity_analysis(
        self, observed: int, result: dict[str, Any], latency: int, run_id: str | None = None
    ) -> str:
        actor, tenant, workspace, device = self.scope
        run_id = run_id or _id("run")
        labels = result["items"]
        with self.connection:
            for label in labels:
                segment = self.connection.execute(
                    "SELECT app,monitor FROM activity_segments WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND segment_id=?",
                    (*self._where, label["id"]),
                ).fetchone()
                if segment is None:
                    raise ValueError("unknown_activity_segment")
                self.connection.execute(
                    "INSERT OR IGNORE INTO activity_evidence (evidence_id,tenant_id,workspace_id,actor_id,device_id,observed_at_ms,app,monitor,service,surface,summary,project_hint,task_hint,category_hint,confidence,domain,audio_active,source_model,created_at_ms,evidence_kind,segment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        _id("evd"),
                        tenant,
                        workspace,
                        actor,
                        device,
                        observed,
                        segment["app"],
                        segment["monitor"],
                        label["service"],
                        label["surface"],
                        label["summary"],
                        label["project_hint"],
                        label["task_hint"],
                        label["category_hint"],
                        label["confidence"],
                        "",
                        0,
                        result["model"],
                        observed,
                        "activity_llm",
                        label["id"],
                    ),
                )
            self.connection.execute(
                "INSERT INTO screen_analysis_runs (run_id,tenant_id,workspace_id,actor_id,observed_at_ms,provider,model,status,latency_ms,input_tokens,output_tokens,error_code,screenshot_captured,evidence_committed,image_disposition,disposed_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    run_id,
                    tenant,
                    workspace,
                    actor,
                    observed,
                    "anthropic_activity",
                    result["model"],
                    "success",
                    latency,
                    result["input_tokens"],
                    result["output_tokens"],
                    "",
                    0,
                    1,
                    "not_captured",
                    0,
                ),
            )
        self.save()
        return run_id

    def add_activity_analysis_error(
        self,
        observed: int,
        error: str,
        latency: int,
        input_tokens: int = 0,
        output_tokens: int = 0,
        model: str = "claude-sonnet-5",
    ) -> None:
        tenant, workspace, actor = self._where
        self.connection.execute(
            "INSERT INTO screen_analysis_runs (run_id,tenant_id,workspace_id,actor_id,observed_at_ms,provider,model,status,latency_ms,input_tokens,output_tokens,error_code,screenshot_captured,evidence_committed,image_disposition,disposed_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                _id("run"),
                tenant,
                workspace,
                actor,
                observed,
                "anthropic_activity",
                model,
                "error",
                latency,
                input_tokens,
                output_tokens,
                error[:80],
                0,
                0,
                "not_captured",
                0,
            ),
        )
        self.save()

    def activity_analysis_log(self) -> dict[str, Any]:
        total = self.connection.execute(
            "SELECT count(*),coalesce(sum(status='success'),0),coalesce(sum(status='error'),0),coalesce(sum(input_tokens),0),coalesce(sum(output_tokens),0) FROM screen_analysis_runs WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND provider='anthropic_activity'",
            self._where,
        ).fetchone()
        labels = self.connection.execute(
            "SELECT count(*) FROM activity_evidence WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND evidence_kind='activity_llm'",
            self._where,
        ).fetchone()[0]
        entries = [
            dict(row)
            for row in self.connection.execute(
                "SELECT r.observed_at_ms AS observedAt,r.status,r.model,r.latency_ms AS latencyMs,"
                "r.input_tokens AS inputTokens,r.output_tokens AS outputTokens,r.error_code AS errorCode,"
                "(SELECT count(*) FROM activity_evidence e WHERE e.tenant_id=r.tenant_id "
                "AND e.workspace_id=r.workspace_id AND e.actor_id=r.actor_id "
                "AND e.evidence_kind='activity_llm' AND e.created_at_ms=r.observed_at_ms) AS labels "
                "FROM screen_analysis_runs r WHERE r.tenant_id=? AND r.workspace_id=? AND r.actor_id=? "
                "AND r.provider='anthropic_activity' ORDER BY r.observed_at_ms DESC LIMIT 100",
                self._where,
            )
        ]
        input_tokens, output_tokens = int(total[3]), int(total[4])
        return {
            "attempts": int(total[0]),
            "successful": int(total[1]),
            "failed": int(total[2]),
            "labels": int(labels),
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "estimatedUsd": round(input_tokens * 2 / 1_000_000 + output_tokens * 10 / 1_000_000, 6),
            "entries": entries,
        }

    def correct(self, identifier: str, category: str | None, project: str) -> None:
        if (category is not None and category not in CATEGORIES) or len(project) > 100:
            raise ValueError("invalid_correction")
        row = self.connection.execute(
            "SELECT segment_id FROM activity_segments WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND segment_id=?",
            (*self._where, identifier),
        ).fetchone()
        if row is None:
            raise ValueError("unknown_record")
        if category is None:
            self.connection.execute(
                "DELETE FROM activity_corrections WHERE segment_id=?", (identifier,)
            )
            self.connection.execute(
                "DELETE FROM activity_context WHERE segment_id=?", (identifier,)
            )
        else:
            self.connection.execute(
                "INSERT INTO activity_corrections VALUES (?, ?, ?) "
                "ON CONFLICT (segment_id) DO UPDATE SET category=excluded.category, project=excluded.project",
                (identifier, category, project),
            )

    def delete_range(self, start: int, end: int) -> None:
        original = self.connection.execute(
            "SELECT s.*, c.category, c.project, x.project AS context_project, x.task, x.planning, x.source, "
            "g.window_class,g.aumid,g.uia_domain,g.service,g.surface,g.context_summary,g.context_confidence,g.context_source,g.audio_output,g.audio_input,g.media_title "
            "FROM activity_segments s LEFT JOIN activity_corrections c ON c.segment_id=s.segment_id "
            "LEFT JOIN activity_context x ON x.segment_id=s.segment_id "
            "LEFT JOIN activity_capture_signals g ON g.segment_id=s.segment_id "
            "WHERE s.tenant_id=? AND s.workspace_id=? AND s.actor_id=? AND s.end_ms>? AND s.start_ms<?",
            (*self._where, start, end),
        ).fetchall()
        with self.connection:
            self.connection.execute(
                "DELETE FROM activity_evidence WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND observed_at_ms>=? AND observed_at_ms<?",
                (*self._where, start, end),
            )
            self.connection.execute(
                "DELETE FROM screen_analysis_runs WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND observed_at_ms>=? AND observed_at_ms<?",
                (*self._where, start, end),
            )
            for row in original:
                self.connection.execute(
                    "DELETE FROM activity_segments WHERE segment_id=?", (row["segment_id"],)
                )
                for left, right in [
                    (row["start_ms"], min(start, row["end_ms"])),
                    (max(end, row["start_ms"]), row["end_ms"]),
                ]:
                    if left < right:
                        identifier = self.add_segment(
                            left,
                            right,
                            row["app"],
                            row["title"],
                            row["monitor"],
                            row["kind"],
                            {
                                key: row[key]
                                for key in (
                                    "window_class",
                                    "aumid",
                                    "uia_domain",
                                    "service",
                                    "surface",
                                    "context_summary",
                                    "context_confidence",
                                    "context_source",
                                    "audio_output",
                                    "audio_input",
                                    "media_title",
                                )
                                if row[key] is not None
                            },
                        )
                        if row["category"]:
                            self.correct(identifier, row["category"], row["project"])
                        if row["planning"] is not None:
                            self.set_context(
                                identifier,
                                row["context_project"],
                                row["task"],
                                row["planning"],
                                row["source"],
                            )
            self.connection.execute(
                "DELETE FROM productivity_plans WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND day_ms>=? AND day_ms<?",
                (*self._where, start, end),
            )
        if original:
            self.connection.execute("VACUUM")
        self.save()

    def correct_many(
        self,
        identifiers: list[str],
        category: str | None,
        project: str,
        task: str | None = None,
        planning: str = "unspecified",
        source: str = "Manual correction",
    ) -> None:
        with self.connection:
            for identifier in identifiers:
                self.correct(identifier, category, project)
                if category is not None and task is not None:
                    self.set_context(identifier, project, task, planning, source)
        self.save()

    def set_context(
        self, identifier: str, project: str, task: str, planning: str, source: str
    ) -> None:
        if planning not in ("planned", "unplanned", "unspecified") or any(
            len(v) > limit for v, limit in [(project, 100), (task, 100), (source, 160)]
        ):
            raise ValueError("invalid_context")
        if not self.connection.execute(
            "SELECT 1 FROM activity_segments WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND segment_id=?",
            (*self._where, identifier),
        ).fetchone():
            raise ValueError("unknown_record")
        self.connection.execute(
            "INSERT INTO activity_context VALUES (?, ?, ?, ?, ?) ON CONFLICT(segment_id) DO UPDATE SET project=excluded.project, task=excluded.task, planning=excluded.planning, source=excluded.source",
            (identifier, project, task, planning, source),
        )

    def plans(self, start: int, end: int) -> list[dict[str, Any]]:
        return [
            dict(row)
            for row in self.connection.execute(
                "SELECT plan_id AS id, day_ms AS day, title, project, minutes, completed FROM productivity_plans WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND day_ms>=? AND day_ms<? ORDER BY day_ms, plan_id",
                (*self._where, start, end),
            )
        ]

    def save_plan(
        self, identifier: str, day: int, title: str, project: str, minutes: int, completed: bool
    ) -> None:
        if (
            not title.strip()
            or len(title) > 100
            or len(project) > 100
            or type(minutes) is not int
            or not 1 <= minutes <= 480
            or type(completed) is not bool
        ):
            raise ValueError("invalid_plan")
        if identifier:
            cursor = self.connection.execute(
                "UPDATE productivity_plans SET title=?, project=?, minutes=?, completed=? WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND plan_id=?",
                (title.strip(), project.strip(), minutes, int(completed), *self._where, identifier),
            )
            if cursor.rowcount != 1:
                raise ValueError("unknown_plan")
        else:
            if len(self.plans(day, day + 86400000)) >= 30:
                raise ValueError("plan_limit")
            tenant, workspace, actor = self._where
            self.connection.execute(
                "INSERT INTO productivity_plans VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    _id("plan"),
                    tenant,
                    workspace,
                    actor,
                    day,
                    title.strip(),
                    project.strip(),
                    minutes,
                    int(completed),
                ),
            )
        self.save()

    def delete_plan(self, identifier: str) -> None:
        if (
            self.connection.execute(
                "DELETE FROM productivity_plans WHERE tenant_id=? AND workspace_id=? AND actor_id=? AND plan_id=?",
                (*self._where, identifier),
            ).rowcount
            != 1
        ):
            raise ValueError("unknown_plan")
        self.save()

    def close(self) -> None:
        if not self.closed:
            self.connection.close()
            self.lock.close()
            self.closed = True

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()
