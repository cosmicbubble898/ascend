# Ascend full audit — 2026-09-09

## Verdict

Ascend's current local transcription and personal activity-tracking vertical slices are usable, but the product is not complete and several claims in the interface and implementation plan were stronger than the evidence supported. The highest-risk correctness defects found in this audit were fixed. The remaining gaps below are explicit release blockers or follow-up work rather than hidden assumptions.

## Scope audited

- Electron shell, background lifecycle, login startup, tray and timed pause.
- Python productivity service, Windows metadata, UI Automation, Core Audio signals, screenshot eligibility, Claude vision, fusion, encrypted storage and timeline queries.
- Timeline, review, settings and processing-log interfaces.
- Local Parakeet upload transcription and export behavior.
- Automated tests, packaged runtime, production dependency audit, repository state and current owner-vault structure.
- Previously agreed exclusions: OCR, calendar, MCP, external integrations, and expansion of habits/coaching/repeated-work features.

## Defects fixed during this audit

### 1. Vision evidence could be attached to the wrong timeline rows

The timeline query matched evidence by application within a broad time window. One screenshot could therefore appear to support several adjacent rows. In the current owner vault, 38 of 39 evidence records could match multiple segments under that old rule.

The query now requires the evidence timestamp to fall inside the exact segment interval and requires both the application and monitor to match. A regression test covers this behavior.

### 2. Unrelated Windows events could trigger screenshots

The event collector accepted every system-wide object-name event. Background applications could consequently make a screenshot eligible even without a relevant foreground-window change.

The collector now accepts foreground changes and foreground-window name changes only. A regression test rejects unrelated events.

### 3. Startup could take a screenshot without fresh user activity

The capture baseline began at zero, so historical input state could qualify the first sample. Ascend now establishes a baseline on the first active sample and waits for activity after that baseline.

### 4. Disabling title details bypassed UIA safety

When title details were disabled, UI Automation safety inspection was also skipped, although cloud vision could remain enabled. Ascend now runs UIA safety whenever vision is active and suppresses title/domain storage only after the safety decision.

### 5. Chrome UIA could fail because renderer and browser PIDs differ

UI Automation previously required the focused element's process ID to equal the foreground window's process ID. Multi-process browsers commonly violate that condition. Ascend now permits a mismatch only when both processes resolve to the same executable name. A direct accessibility probe succeeded on ChatGPT; a controlled Chrome proof remains open.

### 6. Explicit corrections could lose to vision

High-confidence vision output could override user or context rules. User and application rules now win category, project and task selection. Verified domain adapters outrank contradictory vision. Audio meeting support now considers both render and capture signals.

### 7. Screenshot deletion claims were inaccurate

Legacy vision records had no deletion receipt but the settings interface described them as deleted. The interface now distinguishes verified deletion after commit, deletion without a commit receipt, unverified legacy deletion, pending deletion and no capture.

### 8. Privacy badge understated cloud processing

The global badge said only “On your device” while optional screenshots could be sent to Claude. It now says “Local data · optional Claude.”

### 9. A transient Windows capture error stopped tracking

A single capture exception previously changed the service to an error state and stopped useful tracking. Capture failures now close the current segment and record an unavailable sample while the service continues. Fatal command, storage or service failures terminate the child so Electron can restart it.

### 10. A disabled startup entry stayed disabled

Manual launch previously preserved a disabled Windows Startup registration. Ascend now restores missing or disabled login startup whenever the app is launched normally. Windows policy can still block startup, and this is sign-in startup rather than execution before login.

### 11. Settings wording overstated title behavior

The settings text implied that UI Automation supplied every title. It now accurately says Windows supplies window titles and UI Automation performs separate context and safety work.

### 12. The engine package build failed after PyInstaller

In the final clean package run, Windows PowerShell intermittently lost discovery of `Get-FileHash` after PyInstaller exited. The build now computes the executable SHA-256 through the .NET cryptography API with deterministic stream disposal. A subsequent clean package and packaged-runtime verification passed.

### 13. Separate Sonnet activity analysis and 60-second vision cadence

Screenshot analysis remains on Claude Haiku with its original DPAPI-protected key and separate usage ledger. A second independently protected key now runs Claude Sonnet 5 over bounded Windows/title/UIA/domain/service/audio and Haiku-result metadata. Results are segment-scoped, confidence-gated, fused deterministically, reviewable, and costed separately. Screenshot eligibility changed from 120 to 60 seconds while active, with a 1,440-per-day safety ceiling. Electron windows whose title identifies Ascend are displayed as “Ascend app.”

## Verified evidence

- Python quality gates: Ruff passed, mypy passed, and 116 tests passed after the fixes.
- Shell quality gates: TypeScript typecheck and lint passed; 21 Vitest tests passed.
- Packaged application: the hardened package starts quietly, launches its bundled Python engine, creates an isolated encrypted vault and skips test-environment login registration.
- Storage: the live vault is at schema 8 with foreign keys enabled. The earlier sampled database contained 4,628 segments with no overlapping intervals.
- Activity analysis: a real Claude Sonnet 5 request succeeded against a synthetic evidence bundle. The live service subsequently committed 15 successful batches containing 180 segment labels, with separate input/output token and cost accounting. In the latest 24-hour query, 83 rows used Sonnet evidence, 43 used Haiku evidence, and 3 combined both. Four pilot failures remain visible in the ledger rather than being silently discarded.
- Vision: the sampled database contained 39 successful attempts and no pending image files. Three new records carry `discarded_after_commit`; 36 older records predate deletion receipts and are reported as unverified legacy records.
- Secrets: no pasted Anthropic key was found in repository content. The configured local key is DPAPI protected.
- Production JavaScript dependencies: `npm audit --omit=dev` reported zero known production vulnerabilities.
- Python environment: `uv pip check` reported compatible installed packages.

## Important unfinished work

### Release blockers

1. **Transcript autosave and library are absent.** The transcript exists only in renderer memory until the user manually saves a text file. This contradicts the requested automatic-save behavior.
2. **The repository is not recoverable as a coherent revision.** The working tree currently has 30 tracked changes and 74 untracked paths on `backup/pre-format-2026-08-11` at `2a28537`. No commit contains the working product. A disk failure or accidental reset could lose the implementation.
3. **Hardware lifecycle proof is incomplete.** Reboot/logoff, lock/unlock, sleep/resume, monitor unplug/reconnect, mixed DPI and protected-content behavior have not all been exercised on physical hardware.
4. **Multi-monitor proof is incomplete.** Three displays were detected, but the final strict automated run captured none of the generated display samples because Windows reported the test session as idle. The functional UI assertions passed, but the hardware assertion correctly failed. The test must remain strict until a real active, unlocked, multi-monitor sequence is demonstrated.
5. **The current build is a development package.** There is no signed installer or public distribution certification for this revision.

### Activity intelligence gaps

- Timeline correction supports category/project/task review but lacks service/activity-type correction, manual split/merge and a dedicated unknown-context review queue.
- Evidence cannot be individually deleted from the product interface.
- Skipped screenshot reasons and fusion decisions are not shown in the processing log.
- UIA-derived browser domains are sparse. Only 2 of 151 sampled new signal rows contained a UIA domain. The multi-process fix is implemented but not fully proven in Chrome.
- Core Audio signal capture is structurally present but unproven in the sampled owner data: 0 of 151 sampled new rows contained active output or input sessions.
- Audio attribution uses executable identity. Shared browser processes and profiles can make attribution approximate.
- A vision request already in flight cannot be cancelled at the HTTP transport layer when the user pauses, locks Windows or exits. Its provider cost/outcome can therefore be ambiguous for up to the request timeout.
- The screenshot byte buffer is zeroed after a committed receipt, but immutable base64, JSON and HTTP-library copies plus operating-system paging cannot be explicitly erased. Product language must not promise perfect memory erasure.
- GDI capture is downscaled to a maximum width of 1280. The earlier 1920-pixel benchmark was not implemented.
- There is no blank-frame or protected-content detector before provider submission.
- Provider key setup, connectivity testing and removal are scripts rather than product settings.
- Vision validation constrains enums and lengths but does not yet implement all planned URL, markup and sensitive-token rejection, prompt/schema version storage, typed provider failures or cancellation.
- The planned analyzer protocol and fake adapter were not implemented; the service imports the concrete provider directly.
- Evidence is associated with timeline segments at query time; the schema has no immutable evidence-to-segment foreign-key relation.
- The encrypted vault is rewritten periodically. Its present size is about 2.5 MB, but long-duration CPU, battery and write-amplification behavior has not been benchmarked with the new signal volume.
- The app uses Windows sign-in startup. There is no external watchdog if the entire Electron process crashes, and startup currently targets the development checkout.

### Broader product gaps

- Dictation is not implemented.
- Meeting recording and meeting-note generation are not implemented.
- The long-term personal memory/agent experience is not implemented.
- OCR, calendars, MCP and external integrations are intentionally outside the current approved scope, so they are not counted as defects here.

## Dependency and security findings

- The full development dependency audit reports 23 advisories: 18 high, 2 moderate and 3 low. They are in the build/test toolchain rather than the shipped production dependency set. Notable paths include Vitest, Electron Forge/extract-zip, xmldom, fast-uri, js-yaml and tmp. Upgrades need a controlled dependency change and a fresh packaged-app test.
- The Anthropic credential was pasted into chat. Even though it is not present in source and its local copy is protected, the test key should be rotated after this pilot.
- Screenshot images are deliberately retained until vision succeeds and its database evidence is committed. Failed or interrupted work must continue to remain visible as pending rather than being silently described as deleted.

## Required next implementation order

1. Commit or otherwise back up the current reviewed state in a coherent revision.
2. Implement transcript autosave, local transcript history and explicit retention/deletion controls.
3. Finish timeline correction: split, merge, service/activity correction, unknown queue and evidence deletion.
4. Add skipped-capture and fusion-decision audit records.
5. Prove Chrome UIA and Core Audio on controlled cases, then correct attribution where evidence fails.
6. Complete physical reboot, lock, sleep, monitor, DPI and active-monitor acceptance tests.
7. Add provider cancellation/reconciliation, stricter response validation and prompt/schema versioning.
8. Benchmark long-run resource use, then create and verify a signed installer.

## Honest release statement

The current revision is a strong local prototype with verified transcription, background tracking, encrypted local storage, constrained screenshot analysis and an evidence-backed timeline. It should not yet be described as a finished or production-ready personal productivity agent.
