# Ascend local prototype handoff — 2026-09-10

## Outcome completed

The current Windows-first Ascend prototype is preserved as one coherent source revision. It includes local English Parakeet file transcription, resident personal productivity tracking, Windows metadata and UI Automation capture, optional Claude vision and Sonnet classification, an evidence-backed correctable timeline, processing and cost logs, branding and zoom controls, and encrypted seven-day clipboard history.

The final clipboard repair makes Copy last 3/5/10/15/custom produce the requested number of pasteable attachments whenever the selection contains files or images. Existing files remain references to their original Windows paths. In-memory images and text are materialized as temporary PNG and TXT files under Ascend's seven-day clipboard folder. File paths are transported to the native Windows clipboard through JSON on standard input, avoiding PowerShell command-token parsing failures.

## Important decisions and changed areas

- The active application repository is `C:\Users\samar\Desktop\ascend`.
- The product remains a local personal Windows application; team administration and client billing are outside the current scope.
- Parakeet transcription remains local-only and English-only.
- Productivity evidence remains correctable, source-labelled and confidence-bearing.
- Screenshot images are deleted only after analysis has succeeded and the evidence receipt has committed; legacy deletion state remains labelled honestly.
- Vision and metadata classification use separately protected Anthropic credentials and separate usage ledgers. No credential value is stored in the repository.
- Clipboard disk-file entries retain only their original paths. Copied text and in-memory images are encrypted for seven days. Batch-paste materializations live under the same retention-bound clipboard area.
- Local screenshots, user data, databases, model assets, credentials, runtimes, build output and caches remain Git-ignored.

Primary implementation areas are `shell/main`, `shell/renderer`, `src/ascend_engine/productivity`, `src/ascend_engine/storage`, `src/ascend_engine/transcription`, `scripts`, specifications under `docs`, and their matching Python, Vitest and Node policy tests.

## Verification

- Python: 120 tests passed with the pinned project runtime.
- Electron and Node policy suite: 11 Vitest files / 36 tests passed; all package, installer, manifest, toolchain and documentation policy tests passed.
- TypeScript typecheck and ESLint passed.
- Shell build and full Electron/Python package completed successfully.
- Live clipboard proof: a controlled five-entry selection containing two text entries, one in-memory image, one MP4 and one MP3 produced exactly five existing Windows FileDrop attachments.
- Secret scan of 161 changed source candidates found no Anthropic key, Deepgram key, private key or generic credential assignment.

## Git and environment

- Branch: `backup/pre-format-2026-08-11`.
- Base before closeout: `2a28537`.
- Commit: this document is included in the coherent closeout commit.
- Push targets: public `origin` (`cosmicbubble898/ascend`) and private `privbak` (`cosmicbubble898/ascend-backup`) on the same non-default branch.
- Target environment: current local Windows development machine. The packaged app is an unsigned development package and is not a public production release.

## Remaining work and exact next step

1. Implement transcript autosave, a local transcript library, and explicit retention and deletion controls.
2. Extend timeline correction with split, merge, service/activity correction, an unknown-context queue and evidence deletion.
3. Add skipped-capture and fusion-decision records to processing logs.
4. Complete controlled Chrome UI Automation and Core Audio attribution proofs.
5. Complete physical reboot, lock, sleep, monitor, DPI and active-monitor acceptance tests.
6. Add provider cancellation/reconciliation, stricter response validation and prompt/schema versioning.
7. Benchmark long-running CPU, battery and encrypted-vault write behavior before installer work.

The best next session is transcript autosave and the transcript library. The detailed limitations and release blockers remain in `docs/reviews/ASCEND-AUDIT-2026-09-09.md`.
