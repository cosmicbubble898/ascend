# Audit remediation proposal

**Status:** Implemented and verified locally on 2026-08-10; release gates remain open
**Prepared:** 2026-08-05
**Approved:** 2026-08-10 (`continue`, in direct response to the required approval request)
**Scope:** Local synthetic-data foundation only

## Objective

Correct the blocking and medium-priority findings from the 2026-08-05 foundation audit without broadening Ascend's product scope or release authority. The result must remain unsigned, local-only, synthetic-only, unpublished, and undeployed.

This proposal does not authorize signing spend, an updater, outside testing, publishing, deployment, provider credentials, real user data, screenshot capture/storage, a model/runtime, an integration, an agent runtime, or Task 6 migration implementation.

## Approved behavior to preserve

- Forge remains the application packager and keeps `makers: []`.
- Electron-builder remains only the offline x64 NSIS wrapper around the prepackaged Forge output.
- The exact non-recursive `build/installer.nsh` cleanup macro remains unchanged.
- Installation remains per-user, `asInvoker`, unsigned, offline, and non-publishing.
- Uninstall preserves `%APPDATA%\Ascend` and removes only the exact cached installer plus an empty cache directory.
- The renderer remains sandboxed, local-content-only, permission-denied, context-isolated, and without Node integration.

## Remediation slices

### R1 — Security-supported build and runtime baseline

1. Update the project-local build host from Node `22.23.1` to the official Node `22.23.2` security release. Keep npm `10.9.8` if the official Node archive confirms that bundled version.
2. Update Electron from `43.1.1` to current stable `43.3.0` so the packaged runtime moves from Chromium `150.0.7871.114` to `150.0.7871.212` and Node `24.18.1`.
3. Keep stable Forge `7.11.2`; do not adopt experimental Forge 8 alpha.
4. Keep exact electron-builder `26.15.7`; do not switch distribution architecture or follow mutable npm tags.
5. Regenerate the lockfile with lifecycle scripts blocked and accept semver-compatible transitive security fixes.
6. If Forge's fixed direct version still resolves vulnerable `tar@6`, add only the exact root npm override `tar: 7.5.22`. This major transitive override is acceptable only if install, Forge packaging, fuse verification, package-manifest comparison, electron-builder wrapping, and installer smoke tests all pass. Any API/runtime failure removes the override and stops packaging for a new decision; do not weaken the audit gate.
7. Do not add an override for unrelated interactive CLI packages merely to reduce an aggregate count. Record any remaining development-only advisory with exact dependency path and reachability. No critical advisory may remain in the executed packaging path, and the packaged application audit must remain zero.

### R2 — Fail-closed installer policy

1. Add a repository-policy CLI mode to `scripts/installer-policy.cjs`.
2. Run that complete repository policy before `npm run package` in `scripts/build-installer.ps1`.
3. Replace substring-only command validation with one exact normalized electron-builder invocation block. Reject duplicate or additional `--config`, `--config.*`, `--win`, `--publish`, target, script, or positional arguments.
4. Add focused tests proving the previously accepted malicious additions fail:
   - `--config malicious.config.cjs`
   - `--config.nsis.script malicious.nsh`
   - `--win nsis-web`
5. Keep the existing exact configuration, include-content/hash, dependency, AppUserModelID, target, elevation, publishing, updater, and artifact-name checks.

### R3 — Installer evidence integrity

1. Bind smoke testing to the unique proof run whose recorded artifact SHA-256 matches the installer under test. Do not select the lexically latest proof directory.
2. Validate the recorded artifact hash file before install.
3. Inventory the complete installed tree. Every expected prepackaged file must match size and SHA-256, and every additional file must be on a narrow installer-owned allowlist. Initially the only candidate is `Uninstall Ascend.exe`; observed reality wins and any other extra file stops the proof for review.
4. Retain the installed-tree manifest with the smoke evidence.
5. Construct the intended Unicode test character with `[char]0x00DC`, resolve the created path, and assert the actual directory contains U+00DC and not the prior mojibake code points.
6. Describe persistence checks as the exact tested surfaces, not as a universal absence claim.

### R4 — Reproducible Python toolchain selection

1. Add a project-local Python-toolchain bootstrap using already approved `uv 0.11.29` and Python `3.13.14` under ignored `.tools/` and `runtime/` directories.
2. Verify the uv archive against the already reviewed official SHA-256 before extraction.
3. Make `check.ps1`, `check-python.ps1`, and `build-engine.ps1` resolve the exact project-local uv executable and local managed Python/cache/environment paths first. They must not silently use another global uv.
4. Fail with one actionable bootstrap command when the project-local toolchain is absent.
5. Do not modify the user's global PATH, Python installation, or profile.

### R5 — Privacy and specification corrections

1. Replace the guarantee that every private context/password field is blocked at capture source with a testable contract: provider-aware best-effort filtering, explicit app/window exclusions, fail-closed handling where detection is unavailable, visible residual risk, and no claim that secret capture is impossible.
2. Correct the stale encryption sentence: synthetic Task 5/Task 6 work is allowed under OD-03, while proven encryption remains mandatory before real data or outside testing.
3. Replace stale `work-entity` terminology with `memory entity/context` except in clearly marked historical quotations.
4. Clarify Task 8 so an acting actor is mandatory and optional caller/client provenance never substitutes for actor identity.
5. Record the installation-identity filename/path/format/ACL/atomic-write/reparse behavior as a blocking Task 7 decision. Do not select or implement it through this remediation.

### R6 — Preserve and reconcile evidence

1. Keep the existing `20260805` installer proof as historical evidence; do not rewrite its retained files.
2. Create a new dated proof only after R1–R4 pass.
3. Update current review documents with the new versions, advisory state, artifact hash, exact proof limitations, and any remaining upstream risk.
4. Do not commit or push until the founder separately requests it after reviewing the completed diff.

## TDD and verification order

1. Write one focused failing installer-policy test for extra CLI overrides; implement the minimum exact validation; rerun focused and complete policy tests.
2. Write one focused failing installed-tree/proof-binding test; implement the minimum validation; rerun manifest and policy tests.
3. Add the Unicode-path assertion and confirm it would reject the retained mojibake evidence before running a new smoke proof.
4. Add toolchain-resolution verification, then prove the documented one-command gate works from a normal shell without temporary environment injection.
5. Apply approved dependency changes with lifecycle scripts blocked; run lock/version checks, npm audit, registry-signature verification, the complete quality gate, Forge package/fuse/ASAR checks, and secret scans.
6. Build exactly one unsigned local installer, verify one-artifact output and manifests, then run the bounded install/launch/close/uninstall/sentinel/reinstall/Defender smoke proof.
7. Review the final diff for security, deletion safety, scope creep, stale claims, and unrelated changes.

## Acceptance criteria

- Node and Electron match the exact approved patched versions and their official checksums/metadata.
- The normal documented quality command passes without manually injecting hidden environment variables.
- Previously accepted malicious electron-builder CLI additions are rejected automatically.
- Installer build cannot begin unless complete repository policy passes.
- Smoke evidence is bound to the tested artifact hash and exact proof manifest.
- The complete installed file set is checked, not only expected files.
- The Unicode source directory contains the intended U+00DC character on disk and in evidence.
- Full npm audit has no critical advisory in an executed packaging path; packaged/runtime dependency audit remains zero; all residual development findings have a dated path-and-reachability record.
- PyPI OSV query, formatting, lint, type checks, unit tests, builds, PowerShell parsing, package manifests, fuse verification, Defender scans, and bounded installer lifecycle checks pass.
- No signing, publishing, updater, real data, outside test, deployment, provider, model, screenshot, agent, or Task 6 scope enters the change.

## Stop conditions

Stop and return for a new decision if the patched Electron breaks the shell/package boundary, the exact tar override breaks or changes Forge behavior, the installer needs a broader script/macro/deletion path, installed extras cannot be narrowly explained, the new proof leaves executable residue, Defender reports a threat, or any fix requires release authority, real data, credentials, cost, or a new product capability.

## Approval text

> Approved: `AUDIT-REMEDIATION-PROPOSAL`. Implement R1–R6 exactly as a local-only synthetic-data remediation. Node `22.23.2`, Electron `43.3.0`, semver-compatible lock refreshes, and the conditional exact `tar 7.5.22` override are approved only under the listed tests and stop conditions. Keep Forge `7.11.2`, electron-builder `26.15.7`, the exact non-recursive cleanup macro, and all signing, publishing, updater, real-data, outside-testing, deployment, provider, model, screenshot, agent, and Task 6 gates unchanged. Do not commit or push without a separate request.

The founder authorized continuation under this exact proposal on 2026-08-10. Official sources were rechecked immediately before implementation: Node `22.23.2` remains the current Node 22 release, Electron `43.3.0` remains the current stable Electron release, and Forge `7.11.2` remains the current stable Forge release.

## Outcome

R1–R6 passed without a stop condition. The current evidence, residual development-only advisory path, installer artifact hash, proof limitations, and unchanged gates are recorded in `docs/reviews/AUDIT-REMEDIATION-2026-08-10.md`. No commit or push was performed.
