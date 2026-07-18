# Implementation Plan: Ascend Milestone 0 Foundation

**Status:** Foundation architecture and stack/version proposal approved; Tasks 2 and 3 are complete. Task 4 has `no-go` results for Squirrel and standard electron-builder NSIS and is blocked at OD-16's exact non-recursive cleanup proof. OD-03 selected synthetic-only plain storage. Named signing, encryption-before-real-data, credential, provider, and production gates remain in force.

## Overview

Milestone 0 creates a small, verifiable Windows project foundation: confirmed dependency choices, reproducible quality commands, an organization-ready tenant/identity/workspace model, an early installer/AV risk result, numbered database migrations, a tenant/workspace-scoped data-access layer, and a supervised shell-to-engine connection. It does not implement dictation, production meeting capture, productivity tracking, MCP, or organization collaboration.

## Dependency order

```text
Approved foundation architecture
    -> verified runtime/dependency choices
        -> founder approval of stack/version proposal
            -> project skeleton and quality gate
            -> installer/signing/AV risk spike
                -> tenant/identity/workspace data-model spec
                    -> migration runner
                        -> tenant/workspace-scoped data-access layer
                            -> authenticated local engine surface
                                -> Electron supervisor connection
                                    -> meeting-capture spike
                                        -> screen-context spike
```

## Architecture decisions

- Keep the shell thin and put product behavior in the Python engine.
- Give the engine exclusive ownership of SQLite through one data-access layer.
- Create a local actor, personal tenant, personal workspace, workspace membership, and device from migration 0001.
- Keep tenant accounts separate from client/company work entities.
- Use tests to prove tenant/workspace isolation and ID separation before adding product data.
- Do not add team features; preserve only the seams required to add them safely later.
- Keep inbound Ascend MCP/API separate from outbound provider MCP/API connections.
- Use provider profiles with MCP-first routing and official API/webhook fallback; initial provider operations remain read-only.

## Task sequence

### Phase 0 — Foundation approval and retained gates

- [x] Task 0A: Approve product, organization-ready, process, quality/security, and integration architecture; resolve OD-01, OD-02, OD-02A, and OD-12.
- [x] Task 0B1: Select OD-03 before migration work. **Option 1 approved 2026-07-19: synthetic-only plain storage; encryption before real data or outside testing.**
- [ ] Task 0B2: Record OD-04 before any live provider test.

### Phase 1 — Reproducible skeleton

- [x] Task 1: Verify current official runtime and dependency guidance; propose versions for founder approval without installing them. **Approved 2026-07-18.**
- [x] Task 2: Create the Python engine and Python quality-check skeleton. **Completed 2026-07-18.**
- [x] Task 3: Create the TypeScript/Electron shell skeleton and full quality-gate orchestration. **Completed 2026-07-18.**

### Checkpoint: Skeleton

- [ ] A clean setup can install approved dependencies.
- [ ] The quality-gate script runs every configured check and fails on a red step.
- [ ] No secrets or runtime data are tracked.

### Phase 1B — Early distribution-risk spike

- [ ] Task 4: Package the minimal skeleton and run the installer/signing/SmartScreen/AV spike. **Squirrel and standard NSIS are `no-go`; standard NSIS leaves the cached installer executable after uninstall; OD-16 cleanup proof awaits approval; no signing spend.**

### Checkpoint: Distribution evidence

- [ ] A minimal packaged build installs, starts, exits, and uninstalls on clean Windows test environments.
- [ ] Current signing options, costs, eligibility, and binary coverage are recorded from official sources.
- [ ] If signing is approved and available, every executable/helper in the spike is signed and SmartScreen/AV observations are recorded.
- [ ] If signing is deferred, the residual risk and outside-testing block are explicit rather than reported as passed.

### Phase 2 — Organization-ready local data foundation

- [ ] Task 5: Write and approve the exact migration-0001 data-model specification.
- [ ] Task 6: Implement and test the numbered migration runner.
- [ ] Task 7: Implement and test actor, personal tenant, personal workspace, membership, and device bootstrap.
- [ ] Task 8: Implement and test the tenant/workspace-scoped data-access boundary.

### Checkpoint: Data foundation

- [ ] A new local profile receives stable actor, tenant, workspace, membership, and device IDs.
- [ ] Cross-tenant/workspace reads and writes fail in automated tests.
- [ ] Tenant IDs and client/company work-entity IDs cannot be confused.
- [ ] No application module opens SQLite directly outside the data-access layer.
- [ ] Re-running migrations is safe and deterministic.

### Phase 3 — Process foundation

- [ ] Task 9: Implement and test the loopback-only engine health/readiness surface with a session token.
- [ ] Task 10: Implement and test shell supervision, startup, readiness, graceful shutdown, and force-kill fallback.

### Checkpoint: Milestone 0

- [ ] The shell starts the engine and connects only after token-gated readiness.
- [ ] Closing the visible window does not terminate the supervised engine.
- [ ] Tray Quit closes the database and both processes cleanly.
- [ ] Python and TypeScript tests, lint, formatting, type checks, and builds pass.
- [ ] Code-quality and security reviews find no unresolved blocking issue.
- [ ] Human review approves moving to the meeting-capture spike.

## Next product-risk sequence after Milestone 0

1. Run the one-week meeting-capture spike as throwaway code. Test Meet, Zoom, and Teams with headphones, speakers, Bluetooth, silence, and device switching; measure track completeness, echo, attribution, degradation visibility, and recovery. Record go/fallback/no-go.
2. Run the one-week screen-context spike as throwaway code on multiple Windows machines and common applications; measure task-level usefulness, CPU/storage, password exclusion, and ignore-list safety. Record go/adjust/no-go.
3. Before production onboarding/dictation work, run a first-hour/BYOK study covering zero-key value, honest offline-mode expectations, key setup, failures, and OD-10 starter credits.
4. Write and approve the first production feature specification. Do not promote spike code directly into the product.
5. Execute the separately approved `tasks/integrations-plan.md`; use MCP-first/API-fallback provider profiles for Google Calendar plus ClickUp/Asana assigned tasks. Outlook follows after the Google calendar contract is proven.

## Risks and mitigations

| Risk                                                                 | Impact                                        | Mitigation                                                                                                                                                             |
| -------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Premature organization complexity                                    | Delays individual v1                          | Implement only identity, workspace, membership, scope, and audit seams                                                                                                 |
| Single-user assumptions leak into code                               | Expensive unsafe migration later              | Require explicit tenant/workspace context and cross-tenant/workspace tests from the first DAL behavior                                                                 |
| Historical dependency guidance is stale                              | Broken or insecure scaffold                   | Verify current official sources before installing anything                                                                                                             |
| Windows installer or AV behavior is discovered late                  | Quarantined binaries and failed trials        | Package early, review signing options, and test clean Windows environments before feature work                                                                         |
| BYOK setup and weak offline dictation combine into a poor first hour | Users churn before seeing quality mode        | Study the zero-key journey and key setup before production onboarding; label offline limits honestly                                                                   |
| Shell and engine lifecycle becomes fragile                           | Orphan processes or lost writes               | Test readiness, graceful shutdown, crash behavior, and forced fallback separately                                                                                      |
| Secret-bearing donor files enter the repo                            | Credential exposure                           | Use allowlisted excerpts only and enforce `.gitignore` plus review                                                                                                     |
| “Organization” means both tenant and client/company                  | Authorization confusion and unsafe migrations | Separate tenant and work-entity concepts, IDs, repositories, and tests                                                                                                 |
| Desktop app or logs expose provider app secrets/tokens               | Provider account compromise                   | Keep reusable app secrets only in the separately approved connection service; bind user credentials per actor/account/workspace/environment; scan source and artifacts |
| MCP capability drift or overbroad provider tools                     | Silent breakage or unauthorized writes        | Validate capabilities/schemas, deny unknown and write tools, and retain a contract-tested official API fallback                                                        |
| Connected data is overbroad, stale, or belongs to someone else       | Privacy and correctness failure               | Selected provider scopes/workspaces, signed-in assignee filter, bounded sync, source links, and visible stale state                                                    |

## Out of scope for Milestone 0

- Dictation or transcription
- Production meeting capture (the standalone risk spike follows Milestone 0)
- Productivity tracking
- Work-memory feature tables beyond the approved foundation
- MCP tools or public local API endpoints
- Google/ClickUp/Asana provider integration (required for v1 but planned separately in `tasks/integrations-plan.md`)
- Invitations, shared workspaces, cloud sync, billing, or enterprise features
