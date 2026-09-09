# Basic personal productivity — first implementation

Requested 2026-09-05: build basic productivity before dictation; use existing Windows APIs before OCR or image analysis. This is an implementation slice of the existing charter and PRODUCTIVITY-SCOPE.md. The long-term personal and team directions are preserved.

## Behavior

- A Productivity page beside the existing Transcription tool shows a date-selectable timeline, app/category totals, work sessions, context changes, and modest evidence-based observations.
- Updated 2026-09-06: tracking starts automatically when Ascend opens unless a saved timed pause is active. Settings offers 1/4/24/48-hour pauses, automatic resumption, a countdown, and reminders. Minimize keeps it running; closing exits. See PRODUCTIVITY-EXPANSION-SPEC.md for the expanded current behavior.
- Sample foreground application/window with Win32, session idle state, and display identity. Optional window context uses Win32 titles and supported Windows UI Automation properties. No screenshot, OCR, keystroke, clipboard, microphone, or document-body capture.
- Accessibility is best effort and bounded in an isolated helper. Excluded apps are filtered before context lookup/persistence. Password context, detectable private-window titles, unavailable desktop state, and ambiguous context suppress details. App-only tracking does not promise recognition of private browser sessions. Users can exclude browsers entirely.
- Idle begins after five minutes without input. Unknown/locked states and polling interruptions are gaps, not inferred work. Polling estimates transitions; simultaneous monitors never multiply elapsed time. Browser titles are optional; this slice does not claim URL-level browser coverage.
- Categories are Work, Communication, Learning, Personal, and Uncategorized. Defaults classify known applications conservatively. Correct a block's category/project, undo its correction, or set a persistent app category rule. Communication is not automatically unproductive.
- Counts and durations are calculated locally. Sustained work means at least ten minutes of contiguous Work/Learning activity, allowing related apps; it is not a claim about cognitive attention or work quality.
- Activity saves automatically to an encrypted local vault, with a 30-day history and day deletion. Corrections survive restart. Errors stop tracking visibly rather than claiming data is saved.

## Storage and process boundary

The Python engine owns an in-memory SQLite connection through a scoped data-access layer, retaining the existing numbered foundation migration. Migration 0002 adds scoped activity segments, corrections, rules/settings. Stable personal actor, tenant, workspace, membership, and device identities live inside the same encrypted snapshot, avoiding a split identity/database commit. This bounded feature uses a separate productivity vault; it does not create or alter a previous foundation vault or implement the older separate installation.json proposal.

Persist only Windows current-user DPAPI-protected SQLite snapshots with integrity protection. Never create plaintext SQLite, journal, temp, or backup files. Publish encrypted snapshots through an exclusive same-directory temporary file, flush, and atomic replace. Hold an exclusive lock during ownership; reject symlink/reparse paths and hard-linked files. The vault is under Windows LocalAppData/Ascend/Productivity, outside the repository and Electron profile. The renderer cannot supply a filesystem path. Same-user malware, process memory, OS paging, and user/account recovery remain outside this at-rest protection claim. No portable backup claim is made.

Thirty-day retention and bounded history keep this first snapshot-based implementation small. Capture checkpoints at bounded intervals and on explicit actions/exit; a crash can lose the most recent uncheckpointed interval. UI must disclose the checkpoint interval. Unknown/corrupt data is not overwritten or silently reset.

Electron supervises a hidden Python process using inherited JSON-line pipes, typed bounded commands, validated IPC senders, and fixed executable/module paths. No network listener or model/provider call is needed. Accessibility helper calls are read-only; imported titles remain text and cannot become commands or HTML.

## Proof required

Test interval accounting, idle/lock/gap handling, exclusions, day boundaries, correct/undo/rules, scope isolation, stable identity, encrypted round trips, corruption, competing writers, interrupted writes, and unsafe paths. Verify real Windows API behavior without logging user titles. Exercise the real Electron UI using an isolated synthetic profile, including restart persistence, pause, corrections, empty states, and unchanged transcription access. Report specific limits without claiming OCR, complete application understanding, or mature habit coaching.

## Primary sources

- [GetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow) and [GetLastInputInfo](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getlastinputinfo): foreground and session-specific input-idle metadata.
- [UI Automation overview](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-overview): accessibility properties; support depends on providers.
- [CryptProtectData](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata): current-user encryption and integrity protection, without machine-wide scope or interactive prompts.

Sources checked 2026-09-05. [Implementation review and verification limits](reviews/BASIC-PRODUCTIVITY-2026-09-05.md), including the pending live multi-monitor check.
