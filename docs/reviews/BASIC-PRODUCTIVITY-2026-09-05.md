# Basic personal productivity review — 2026-09-05

**Result:** First implementation built and opened locally. Storage, accounting, correction controls, restart persistence, and the existing transcription regression pass. Live foreground capture across monitors is **not yet verified**: the final automated desktop session returned no foreground window, and the hardware assertion remains failing. This is ready for an initial owner test, not a claim of complete hardware qualification.

## Delivered behavior

The new Productivity tab uses Win32 application/window, input-idle, and monitor metadata. Optional title context uses a bounded Windows UI Automation helper to check focused-control metadata and suppress password or unavailable context. It does not extract document bodies, URLs, screenshots, OCR, keystrokes, or clipboard content.

Users explicitly start or pause capture, inspect a daily timeline and app totals, correct categories and project labels, undo corrections, set app rules, exclude apps, and delete a day's history. Work-session estimates and app-change observations are calculated from recorded intervals; they are not an assessment of attention or work quality. Locked, excluded, unavailable, and interrupted observations do not invent work time.

Activity saves approximately every 30 seconds and on pause/exit, in a Windows current-user DPAPI-protected vault under `%LOCALAPPDATA%\Ascend\Productivity\activity.vault`. New launches start paused. Minimized capture continues until paused or the app closes. Retention is 30 days. The UI explains that a crash can lose the latest uncheckpointed interval.

## Verification evidence

| Check | Observed result |
| --- | --- |
| Python suite | 86 tests passed, including 12 focused productivity tests |
| Python quality | Ruff lint and format passed; mypy passed for 28 source files |
| Shell and project scripts | `npm test` passed, including 13 Vitest tests and packaging, installer, toolchain, and documentation policy suites |
| Shell quality/build | ESLint, TypeScript, Prettier, and shell compilation passed |
| Interval accounting | Tested idle/gap handling, clock rollback, restarts, and sustained-work accounting without adding unobserved gaps |
| Storage | Tested encrypted round trips, identity/scope isolation, corruption, writer conflicts, unsafe hard links, failed atomic publication, rules, correction/undo, and partial-day deletion |
| Real Electron UI with synthetic history | Passed daily totals, category/project correction, Unicode project-label persistence, undo, exclusions, start/pause controls, restart, day deletion, empty state, 800 px layout, and renderer network denial |
| Initial native metadata probe | Returned active with application, title, monitor, and Windows accessibility context available; user titles were not logged |
| Final live monitor assertion | **Incomplete/failing:** 3 displays connected, 0 native active displays captured; both sampled states were `unavailable`, idle true, no app, and no service error. Direct `GetForegroundWindow` returned NULL |
| Existing Parakeet regression | Passed real 11-second audio transcription in 7.061 seconds, native choose/export, clear, and cancellation during model preparation in 5.386 seconds |
| Normal launch | Native Ascend window visible; production Python worker uses the default vault, without a QA path override; encrypted vault created and tracking starts paused |

The UI and hardware checks are reported separately. `scripts/verify-productivity-ui.cjs` prints the successful UI assertions before its strict native monitor assertion, then exits nonzero when hardware evidence is missing. No live multi-monitor assertion was replaced with a synthetic pass.

Synthetic screenshots are in `runtime/productivity-qa/`: `productivity-overview.png`, `productivity-settings.png`, `productivity-compact.png`, and `productivity-empty.png`. They are ignored development artifacts. QA uses a separate profile and vault; it does not edit the owner's history.

## Review boundaries and remaining checks

The engine is the sole SQLite owner, through a tenant/workspace/actor-scoped data-access layer. Migration 0001 remains unchanged; 0002 adds the productivity tables. Stable personal identity lives in the protected snapshot. The renderer receives bounded typed operations through sender-validated IPC and cannot choose a storage path. The Python service uses inherited pipes and makes no network or provider calls. UI content is inserted as text.

SQLite lives in memory; only DPAPI-protected snapshots are written to disk. Exclusive ownership, atomic publication, static reparse/hard-link rejection, corruption refusal, and scope checks were reviewed. This is not a claim of complete native path pinning, protection from same-user malware, exclusion from OS paging, or portable backups. It does not complete the older separate installation-identity proposal or qualify a distributed installer.

The final desktop session could not provide a foreground window. The specific cause is unconfirmed; no activation, unlock, or input was fabricated to mark the check passed. Repeat the live check in an active, unlocked desktop: start tracking, use an ordinary app on each display, pause, and verify the recorded app/display blocks and elapsed time. Then verify lock/unlock and sleep/resume with no time attributed to the gap. The test's strict monitor assertion must pass before recording that hardware result as verified.

Window-title/private-context filtering is best effort; titles are off by default and whole-app exclusion is available. Browser URL extraction, broad accessibility text, OCR, mature habit coaching, agent memory, dictation, and meeting capture remain subsequent work. The visible timeline shows at most the latest 200 grouped blocks for a day, while totals include the complete selected period. Whole-vault snapshots are bounded to 64 MiB; larger-scale storage needs a separate design.

Automatic **activity** saving is implemented. Automatic **transcript** saving remains on the task list; existing transcription export is still manual. No dependency, credential, remote service, commit, push, or deployment was added by this productivity change.
