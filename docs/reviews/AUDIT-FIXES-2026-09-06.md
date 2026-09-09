# Ascend audit repairs — 6 September 2026

Scope: the six confirmed defects in [the audit](ASCEND-AUDIT-2026-09-06.md), authorized by the founder's request to fix them. No new dependencies, schema, cloud processing, or owner-history changes.

## Repairs

- Transcription serializes worker retirement and subsequent model startup. It waits for pipe closure, not merely supervisor exit; completed jobs exit gracefully, stalled cleanup fails visibly, and cancellation stops accepting results while retirement finishes. No CPU/cloud fallback was added.
- Retry tracking now starts the unavailable engine directly. Ordinary tracking settings still open normally.
- Changing the selected date clears the task-edit form. Saving on the new date cannot silently update the previously selected day's task.
- Delete-day confirmation explicitly discloses that the day's planned tasks, activity, and corrections will be removed.
- Timeline search includes the visible task label.
- Packaging includes the feature modules, shared runtime contract, renderer scripts, and installed local Python/model payload. Fixed allowlisted entry points replace editable-venv assumptions. Staging follows compiled local imports, rejects linked paths, preserves dependency notices, and verifies pinned model hashes. The package keeps all production Electron fuses unchanged.

## Verification

- Python suite: 104 passed; mypy: 33 source files; Ruff checks passed.
- Shell suite: 17 passed, including worker-close ordering, graceful-exit escalation, and teardown timeout. All Node policy suites passed (31 tests).
- TypeScript, ESLint, Prettier, build and diff checks passed.
- Real Electron regression verifies unchanged original task, new task on selected date, cleared edit form, visible deletion disclosure, task search, direct engine-crash recovery, and package inclusions.
- Expanded productivity UI scenario passed: automatic capture, pause persistence/expiry, plans, focus/breaks, goals, daily/weekly reviews, workflow evidence, local-classifier review with synthetic responses, corrections, deletion, narrow layout and renderer network denial.
- Real two-hour public/synthetic audio completed in **98.646 seconds**, produced **219 sentence-aligned paragraphs**, and exported exactly. Loading cancellation took **5.230 seconds**. Immediate restart produced text; inference cancellation preserved explicitly partial text. An earlier intermediate version delayed the canceled state and failed that responsiveness check; the final version passed it.
- The rebuilt hardened executable launched its dashboard and automatically captured activity using the packaged Python service. This check caught and repaired one extra shared-contract omission. Native window-control automation could not reliably navigate the packaged window; development-shell UI coverage is separate from packaged-payload verification.
- The packaged payload's production AppContainer completed the public 11-second JFK fixture correctly in **45.43 seconds**, using its own bundled Python, dependencies and model. No checkout runtime paths were used by that worker. Initial packaged read-only sandbox setup passed.
- Three consecutive cancel/restart cycles completed the expected public transcript through real Electron preload/main supervision and the GPU worker (`scripts/verify-transcription-restarts.cjs`). This polls the production state without needing a foreground window. A supplementary repeat of the visual script stalled with its window minimized and was terminated; it is not counted as a pass.

## Limits

Code/security review: renderer IPC validation and network denial are unchanged. Packaged read-only grants target only the fixed AppContainer identity and installed code/model directories; recordings still arrive through brokered ranges. Helper entry points accept only fixed module names. Runtime staging excludes owner vaults, QA recordings and logs; wheel license directories remain included. The owner history was not opened or modified by these repairs.

This is local-machine verification, not a signed installer or public-distribution certification. Native GPU restart behavior still merits broader hardware stress testing. Physical lock/sleep, display reconnect and mixed-DPI testing remain outstanding from the audit. Real local-model classification quality remains unevaluated.

Transcript autosave/library, tray/login startup, OCR, connectors, dictation, meeting recording and the full personal agent remain separate work. Closing Ascend still stops capture. These repairs do not claim those features are implemented.
