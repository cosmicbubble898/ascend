# Personal productivity expansion — verification

**Later audit:** [Ascend audit, 2026-09-06](ASCEND-AUDIT-2026-09-06.md) supersedes any blanket reliability interpretation below. It reproduces a transcription restart failure and productivity recovery/editing/search defects, identifies deletion-disclosure and packaging issues, and separates current passes from incomplete checks.

**Result:** All seven requested feature areas are implemented locally. The first iteration is usable through the existing Ascend launcher. Tracking starts automatically when the updated app opens. Optional AI support requires an installed local Ollama model; no live model was configured or downloaded during this work.

## What changed

Tracking settings offers exactly 1 hour, 4 hours, 1 day, or 2 days. The deadline is encrypted with the rest of the settings, survives restart, and expires automatically. Resume is always available. A persistent countdown and a quiet reminder every 30 minutes make an active pause visible. Native notification success/failure status appears in settings. Tracking still stops when the application exits; no Windows-login startup registration was added.

Category precedence is a manual correction, a remembered window-context rule, an app rule, a known title match, a known app default, then Uncategorized. Each block shows its reason. Users can correct project/task/planning labels and forget context rules. Optional title capture retains its prior Windows accessibility and privacy checks.

Plan & focus supports up to 30 tasks per day, project labels, planned minutes, editing, completion/reopening, deletion, and a timer for a selected task. Captured activity during that timer receives the selected task context. General focus and five-minute breaks are also available. Timer completion measures elapsed time; sustained-work metrics use observed activity. Daily goals and break-reminder intervals are editable.

Reviews & coaching provides selected-day and seven-day reports, previous-period figures, active/sustained time, projects/categories, planned/unplanned/unspecified time, and daily coverage. No-active-sample days are labeled explicitly. A recurring habit requires the condition on at least three days, each with 30+ captured active minutes. Observations remain conditional on captured data and provide a practical experiment.

Automation candidates require a non-overlapping app sequence to repeat at least three times, with bounded gaps. Adjacent samples in one app count as one visit. Suggestions identify possible message-to-task or repeated-reference handoffs and propose a reusable connector/template approach. They do not establish that task content repeated, execute actions, or implement a connector.

## Verification

| Check | Result |
| --- | --- |
| Python regression suite | 104 passed, including deadline/restart/resume, reminders, classification precedence, scope, focus context/completion, recurrence/day-boundary thresholds, malformed/remote AI refusal, and migration preservation |
| Python quality | Strict mypy covers 32 source/test files; Ruff lint/format checks pass |
| Shell checks | TypeScript build/typecheck, ESLint, Prettier, 14 Vitest tests, and the full npm packaging/installer/toolchain/documentation policy suites pass |
| Encrypted upgrade | A synthetic v2 vault upgraded to v3 with unchanged personal identity and preserved activity/category/project data; the plaintext canary is absent from the vault |
| Desktop flow | Real Electron with isolated synthetic profiles passed automatic capture state, pause persistence and expiry, task creation/completion/reopening, focus/break controls, goals, weekly reports, workflow evidence, rule creation/removal, AI preview/apply/undo, day deletion, and transcription access |
| Local AI boundary | An isolated Python child contacted a temporary loopback mock; the test verified that only the selected app/title was sent and no category changed before Apply |
| Native notification | Windows emitted the notification-show event for the synthetic notification test; this verifies OS acceptance, not that Focus Assist or user settings will always display it |
| Layout | All three views fit an 800 px viewport without horizontal overflow; full-size plan/review screenshots were visually inspected |
| Renderer networking | External fetch remained denied |
| Existing Parakeet tool | Final state-checked run passed real 11-second audio transcription in 9.055 seconds, export, clear, cancellation in 5.263 seconds, and restart |

The full desktop scenario is scripts/verify-productivity-expansion.cjs. It refuses to replace an existing local model endpoint, uses isolated QA profiles, and closes its temporary mock server. Synthetic screenshots are under runtime/productivity-qa/ and are ignored artifacts. The earlier basic UI script retains its independent strict native-monitor assertion and has been adapted to timed-pause controls.

Two earlier runs of the additional transcription regression timed out after cancellation: one waiting for a visible Start control during concurrent desktop QA, another waiting for restarted output in a separate run. The final run added typed state diagnostics and error-aware waiting, retained the assertions, and passed. The cause of those intermittent failures is unconfirmed; this work does not claim to have repaired transcription cancellation internals. No transcription production source was changed.

## Data and model boundaries

Migration 0003 adds activity_context and productivity_plans. The prior migrations are unchanged. Only the Python data-access layer opens SQLite; all records/operations are scoped to the current personal actor, tenant, and workspace. Persistent data continues to use the existing DPAPI-protected local vault, atomic publication, writer lock, and retention rules. QA did not open or modify the owner's live vault.

Local AI runs only after Ask local AI. It uses a fixed loopback Ollama endpoint, ignores proxy settings, follows no redirects, validates model metadata/output, and rejects models advertised as remote or named as cloud models. The server is a separately trusted local component. Ascend cannot certify a modified server's internal routing. It sends no cloud credentials and provides no tools to the model. Outputs remain inert text and an allowlisted category until accepted. A supervised child has a 55-second total timeout; the capture loop remains separate.

The optional adapter was verified against a synthetic server, including its real separate-process and UI path. Real-model accuracy, latency, and resource usage remain to be evaluated once a local model is available. No cloud fallback is configured.

Existing limits remain: foreground-window metadata is not knowledge of every task or monitor's visible content; title capture is best effort; browser URLs and document bodies are not captured; work-session estimates are not cognitive-attention measurements. Closing the app stops it, and an unexpected shutdown can lose the latest uncheckpointed interval. The earlier manual multi-monitor/lock/sleep qualification is not replaced by these expansion checks. Screenshot/OCR, dictation, full agent memory, automatic transcript saving, team administration, and billing were not part of this expansion.

Sources used for API contracts: [Electron Notification](https://www.electronjs.org/docs/latest/api/notification), [Ollama chat](https://docs.ollama.com/api/chat). No dependency or runtime version was changed. No commit, push, or deployment was performed.
