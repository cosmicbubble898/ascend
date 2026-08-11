# Implementation Plan: Ascend Milestone 0 Foundation

**Status:** Foundation architecture, stack/version proposal, OD-17 Windows hardware behavior, and OD-20's future local screenshot-context direction are approved; OD-18 future-capability and OD-19 Agent OS architectures are proposed. Tasks 2–4A are complete locally. The exact OD-16 custom-cleanup route remains `go-local`; clean-machine and release qualification remain open. Task 5 specification work is unblocked, but migration implementation still requires human approval of its exact data-model specification, and OD-21 blocks Task 7. OD-03 selected synthetic-only plain storage. Named signing, encryption-before-real-data, screenshot/vision, credential, provider, runtime/model, agent/skill, and production gates remain in force.

## Overview

Milestone 0 creates a small, verifiable Windows project foundation: confirmed dependency choices, reproducible quality commands, an organization-ready tenant/identity/workspace model, an early installer/AV risk result, numbered database migrations, a tenant/workspace-scoped data-access layer, and a supervised shell-to-engine connection. It does not implement dictation, production meeting capture, productivity tracking, MCP, agents, skills, workflows, model-directed tools, or organization collaboration.

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
- Keep tenant accounts separate from every personal or professional memory entity/context; memory content never becomes an authorization principal.
- Use tests to prove tenant/workspace isolation and ID separation before adding product data.
- Do not add team features; preserve only the seams required to add them safely later.
- Keep inbound Ascend MCP/API separate from outbound provider MCP/API connections.
- Use provider profiles with MCP-first routing and official API/webhook fallback; initial provider operations remain read-only.
- Keep domain meaning separate from concrete cloud providers, local models, native runtimes, hardware backends, and meeting capture sources through proposed versioned capability contracts.
- Require explicit local/cloud policy and execution provenance; never hide a locality change or cloud fallback.
- Isolate future dependency-heavy/native/model runtimes in supervised resource-bounded workers without database, credential, MCP, or unrelated workspace authority.
- Preserve a future off-by-default local screenshot-context capability: encrypted retained screenshots and derived visual observations stay distinct, raw pixels never use implicit cloud fallback, and local vision/OCR runs in an isolated network-denied worker. Do not implement it during Milestone 0 or initial v1.
- Keep health, wellbeing, voice-identity, energy, and spiritual-reflection data outside general work and organization access through deny-by-default data classes.
- Keep skills, models, external agents, tools, connectors, workflows, triggers, permissions, approvals, and durable run state as distinct concepts under proposed OD-19.
- Keep identity, memory, context disclosure, policy, execution, verification, and audit inside Ascend; providers remain replaceable and never gain authority through prompt content.
- Treat model output as a typed proposal only. A future side effect must pass the Ascend tool gateway with policy, preview, approval, idempotency, verification, and audit.
- Exclude browser/session automation and private endpoints from foundational ChatGPT/Claude control; keep provider model use, inbound Ascend clients, and outbound external-agent APIs separate.

## Task sequence

### Phase 0 — Foundation approval and retained gates

- [x] Task 0A: Approve product, organization-ready, process, quality/security, and integration architecture; resolve OD-01, OD-02, OD-02A, and OD-12.
- [x] Task 0B1: Select OD-03 before migration work. **Option 1 approved 2026-07-19: synthetic-only plain storage; encryption before real data or outside testing.**
- [ ] Task 0B2: Record OD-04 before any live provider test.
- [x] Task 0C: Approve OD-17 Windows hardware and permission behavior. **Approved 2026-07-19; implementation and native dependencies retain their task gates.**
- [ ] Task 0D: Review OD-18 future capability/runtime-isolation and sensitive-domain architecture. **No model/runtime/bot/wellness implementation is authorized by the proposal.**
- [ ] Task 0E: Review OD-19 Agent OS, skills, typed-tool, durable-run, and external-AI architecture. **No agent/skill/workflow/provider implementation is authorized by the proposal.**
- [x] Task 0F: Record OD-20's future local screenshot-context direction. **Architecture provision only; no screenshot capture/storage, model/runtime, dependency, schema, real data, or v1 scope change is authorized.**

### Phase 1 — Reproducible skeleton

- [x] Task 1: Verify current official runtime and dependency guidance; propose versions for founder approval without installing them. **Approved 2026-07-18.**
- [x] Task 2: Create the Python engine and Python quality-check skeleton. **Completed 2026-07-18.**
- [x] Task 3: Create the TypeScript/Electron shell skeleton and full quality-gate orchestration. **Completed 2026-07-18.**

### Checkpoint: Skeleton

- [ ] A clean setup can install approved dependencies.
- [ ] The quality-gate script runs every configured check and fails on a red step.
- [ ] No secrets or runtime data are tracked.

### Phase 1B — Early distribution-risk spike

- [x] Task 4 local risk result: Package the minimal skeleton and run the installer/signing/SmartScreen/AV spike. **Squirrel and standard NSIS are historical `no-go` routes; OD-16's exact custom-cleanup route passed its bounded current-machine proof. Release qualification remains open; no signing spend.**
- [x] Task 4A: Complete the approved audit remediation. **Verified locally on 2026-08-10; current evidence is in `docs/reviews/AUDIT-REMEDIATION-2026-08-10.md`.**

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
- [ ] Tenant IDs and representative personal/professional memory-entity or context IDs cannot be confused.
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

1. After Task 10, build the approved hardware proposal's fake-adapter state machine and Electron display topology, then separately specify/approve the Windows adapter, capability UX, and physical hardware proof in bounded slices.
2. Run the one-week meeting-capture spike as throwaway code. Test Meet, Zoom, and Teams with headphones, speakers, Bluetooth, silence, and device switching; measure track completeness, echo, attribution, degradation visibility, and recovery. Record go/fallback/no-go.
3. Run the one-week baseline screen-context spike as throwaway code on multiple Windows machines and common applications; compare accessibility metadata with transient local OCR and measure task-level usefulness, CPU/storage, password exclusion, ignore-list safety, and honest coverage gaps. Record go/adjust/no-go. Do not retain screenshots or add a local vision model through this spike.
4. Before production onboarding/dictation work, run a first-hour/BYOK study covering zero-key value, honest offline-mode expectations, key setup, failures, and OD-10 starter credits.
5. Write and approve the first production feature specification. Select the applicable rows from the competitor-failure corpus and, if OD-18 is approved, add only the minimum capability/provenance/isolation seam required by that vertical slice. Do not promote spike code directly into the product.
6. Execute the separately approved `tasks/integrations-plan.md`; use MCP-first/API-fallback provider profiles for Google Calendar plus ClickUp/Asana assigned tasks. Outlook follows after the Google calendar contract is proven.
7. After Milestone 0, approved OD-18/OD-19, and the applicable integration and model/provider gates, consider a separately specified read-only Daily Work Brief as the first agentic slice. It may validate a built-in instruction-only skill, minimum-context broker, provider route, read-only tool gateway, durable run ledger, and source receipts without external writes or autonomy.

## Risks and mitigations

| Risk                                                                             | Impact                                                                | Mitigation                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Premature organization complexity                                                | Delays individual v1                                                  | Implement only identity, workspace, membership, scope, and audit seams                                                                                                                                                |
| Single-user assumptions leak into code                                           | Expensive unsafe migration later                                      | Require explicit tenant/workspace context and cross-tenant/workspace tests from the first DAL behavior                                                                                                                |
| Historical dependency guidance is stale                                          | Broken or insecure scaffold                                           | Verify current official sources before installing anything                                                                                                                                                            |
| Windows installer or AV behavior is discovered late                              | Quarantined binaries and failed trials                                | Package early, review signing options, and test clean Windows environments before feature work                                                                                                                        |
| BYOK setup and weak offline dictation combine into a poor first hour             | Users churn before seeing quality mode                                | Study the zero-key journey and key setup before production onboarding; label offline limits honestly                                                                                                                  |
| Shell and engine lifecycle becomes fragile                                       | Orphan processes or lost writes                                       | Test readiness, graceful shutdown, crash behavior, and forced fallback separately                                                                                                                                     |
| Secret-bearing donor files enter the repo                                        | Credential exposure                                                   | Use allowlisted excerpts only and enforce `.gitignore` plus review                                                                                                                                                    |
| A tenant/account is confused with an organization/client or other memory context | Authorization confusion and unsafe migrations                         | Separate tenant and memory-entity/context concepts, IDs, repositories, and tests; never derive authority from memory content                                                                                          |
| Desktop app or logs expose provider app secrets/tokens                           | Provider account compromise                                           | Keep reusable app secrets only in the separately approved connection service; bind user credentials per actor/account/workspace/environment; scan source and artifacts                                                |
| MCP capability drift or overbroad provider tools                                 | Silent breakage or unauthorized writes                                | Validate capabilities/schemas, deny unknown and write tools, and retain a contract-tested official API fallback                                                                                                       |
| Connected data is overbroad, stale, or belongs to someone else                   | Privacy and correctness failure                                       | Selected provider scopes/workspaces, signed-in assignee filter, bounded sync, source links, and visible stale state                                                                                                   |
| Product modules couple directly to one model/runtime/backend                     | Expensive rewrites and unstable dependencies                          | Use approved versioned capability contracts and one conformance suite; implement only with the first relevant vertical slice                                                                                          |
| Local-only processing silently falls back to cloud                               | Privacy, trust, retention, and cost failure                           | Evaluate explicit locality policy before routing and persist an execution receipt for the route actually used                                                                                                         |
| Model/native runtime compromises or destabilizes the trusted engine              | Data exposure, crashes, or resource exhaustion                        | Pin and verify artifacts; isolate workers from SQLite/credentials/MCP; enforce hard resource budgets, cancellation, supervision, and rollback                                                                         |
| Future screenshots capture secrets or become a local surveillance archive        | Password, private-data, trust, storage, and organization-privacy harm | Keep capture off by default and visible; require pre-capture exclusions, encryption, quotas/retention/deletion, local-only network-denied vision, separate data classes, and no default organization/API/MCP exposure |
| Future meeting bot records or attributes the wrong meeting                       | Consent and privacy failure                                           | Stable event-occurrence identity, admission/idempotency state machine, source/participant provenance, revocation, and partial-artifact recovery                                                                       |
| Health, voice, wellbeing, or spiritual data leaks into work/org paths            | Severe sensitive-data disclosure                                      | Separate deny-by-default data classes and adversarial search/API/MCP/export/AI/organization isolation tests                                                                                                           |
| Skill instructions, model output, or external-agent metadata becomes authority   | Prompt injection, data exposure, or unauthorized action               | Keep policy in deterministic Ascend code; skills never grant permissions; use typed tools, exact approval binding, least context, and adversarial authority tests                                                     |
| Agent retry, crash, or duplicate trigger repeats an external write               | Duplicate or conflicting provider state                               | Durable runs, idempotency keys, attempt ledger, uncertain-state reconciliation, read-after-write verification, and bounded trigger deduplication                                                                      |
| Single-interface goal depends on consumer UI/session automation                  | Credential exposure and brittle wrong-target behavior                 | Use provider APIs, scoped inbound Ascend MCP/API, or documented external-agent APIs; exclude browser/session/private-endpoint control from the foundation                                                             |

## Out of scope for Milestone 0

- Dictation or transcription
- Production meeting capture (the standalone risk spike follows Milestone 0)
- Retained screenshots, continuous screenshot capture, local screen-vision models, or screenshot-derived memory (the future OD-20 slice follows separate encryption, capture, model/runtime, and feature approval)
- Productivity tracking
- Work-memory feature tables beyond the approved foundation
- MCP tools or public local API endpoints
- Google/ClickUp/Asana provider integration (required for v1 but planned separately in `tasks/integrations-plan.md`)
- Invitations, shared workspaces, cloud sync, billing, or enterprise features
- Any local model/runtime, cloud meeting bot, speaker-identity, health/wellness, energy, or spiritual-reflection implementation
- An external plugin SDK or arbitrary third-party code loading
- Any Agent OS runtime, skill loader/marketplace, workflow engine, durable-agent schema, autonomous/background agent, multi-agent orchestration, model-directed write, or external ChatGPT/Claude control
- Browser/UI automation, consumer-session-cookie reuse, or reverse-engineered private endpoints
