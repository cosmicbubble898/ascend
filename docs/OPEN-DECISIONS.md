# Ascend Open Decisions

Agents must not guess these decisions. Resolve each item before its blocking point and record the answer in an ADR or approved specification update.

## Decisions resolved on 2026-07-18, 2026-07-19, 2026-08-04, and 2026-08-05

### OD-01 — Approve the v1 specification — resolved 2026-07-18

- **Decision:** The founder approved the v1 foundation and integration architecture and authorized Task 1 official-source stack/version research.
- **Boundary:** Dependency installation and application implementation still require approval of the Task 1 proposal. OD-03 and OD-04 retained their named gates; OD-03 was later resolved as recorded below.
- **Record:** `docs/SPEC.md`, `docs/FOUNDATION-APPROVAL.md`, and ADR-0003.

### OD-02 — Approve the minimal organization-ready schema principle — resolved 2026-07-18

- **Decision:** Yes. Migration 0001 will contain a local actor, personal tenant, personal workspace, owner membership, and device even though v1 has no team interface.
- **Boundary:** The exact migration and at-rest storage implementation remain specification- and OD-03-gated.
- **Record:** ADR-0001 and `PROJECT-CHARTER.md`.

### OD-02A — Approve tenant versus memory-entity/context terminology — resolved 2026-07-18; clarified 2026-08-05

- **Decision:** Yes. An Ascend personal/organization account is a `tenant`; every personal or professional subject represented inside memory is a separate memory entity/context. Examples include people, relationships, family, organizations/clients, projects, topics, goals, habits, places, events, health/wellbeing domains, and life areas; the list is intentionally non-exhaustive.
- **Invariant:** Memory content is user data, never an Ascend account or authorization principal. Never use one `organization` table, type, or ID for both the authorization boundary and an organization/client represented in memory, and apply the same separation to all other memory entities/contexts.
- **Record:** ADR-0001, `PROJECT-CHARTER.md`, `docs/SPEC.md`, and `docs/DATA-MODEL.md`.

### OD-15 — Public GitHub repository and deployment operations — resolved 2026-07-18

- **Decision:** Ascend's repository is public on GitHub. The founder authorized repository initialization, commits, pushes, and later deployment operations for approved, verified work.
- **Safety boundary:** Public-repository publication requires secret/privacy scanning and generated/runtime-data exclusions. Deployment authorization did not silently resolve other decisions; OD-03 and OD-14 were later answered explicitly. OD-04, OD-11, and OD-13 remain open, and no approval permits signing spend, recurring-cost resources, real credentials/data, or bypassing an approved specification and release gate.
- **Repository target:** `cosmicbubble898/ascend`.

### OD-03 — Confirm the v1 at-rest storage posture — resolved 2026-07-19

- **Decision:** Option 1. Plain SQLite/files may contain synthetic development data only. Encryption is mandatory before Ascend stores real work activity, meeting audio, transcripts, memory, or any outside tester's data.
- **Credential boundary:** Provider credentials remain DPAPI-protected from the first integration.
- **Boundary:** This permits synthetic migration work only after the exact data-model specification is approved. It does not authorize real data or make an encryption claim.
- **Record:** `docs/FOUNDATION-APPROVAL.md`, `docs/SPEC.md`, and `docs/THREAT-MODEL.md`.

### OD-14 — Windows installer fallback after Squirrel no-go — resolved 2026-07-19

- **Decision:** Approve the exact unsigned, local-only `electron-builder@26.15.7` NSIS proof around the unchanged prepackaged Forge output.
- **Boundary:** No signing spend, publishing, updater, web installer, custom NSIS script, real credentials, real user data, outside distribution, or deployment.
- **Outcome:** The proof executed and returned `no-go`: uninstall leaves `%LOCALAPPDATA%\ascend-updater\installer.exe`.
- **Record:** `docs/WINDOWS-INSTALLER-FALLBACK-PROPOSAL.md`, `docs/reviews/NSIS-INSTALLER-PROOF.md`, and `docs/reviews/INSTALLER-SPIKE.md`.

### OD-17 — Windows hardware and permission baseline — resolved 2026-07-19

- **Decision:** Approve `docs/WINDOWS-HARDWARE-BASELINE-PROPOSAL.md`, including all-active-render-endpoint suppression by default, verified mute-before-capture ordering, observable ownership/restoration rules, the explicit Core Audio same-value/final-race limitation, capability-specific onboarding, dynamic devices, and the one-to-six-plus-display test baseline.
- **Boundary:** Approval authorizes the behavior and task sequence only. A native dependency/toolchain, real microphone capture/data, physical hardware testing, signing spend, outside distribution, and deployment retain their named approvals.
- **Record:** `docs/WINDOWS-HARDWARE-BASELINE-PROPOSAL.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/THREAT-MODEL.md`.

### OD-20 — Preserve a future local screenshot-context capability — resolved 2026-08-04

- **Decision:** Preserve an opt-in future capability that can capture and retain screenshots encrypted on the person's Windows machine and analyze them with an approved local vision/OCR model so raw pixels do not need to leave the device.
- **Architecture boundary:** Accessibility/window metadata, transient OCR frames, retained screenshots, and derived visual observations remain distinct. Retained screenshots are off by default, visible, pauseable, target/exclusion scoped, retention-bound, local-only, personal/restricted by default, and processed through an isolated network-denied worker without direct database, credential-store, MCP, provider-grant, or unrelated filesystem access.
- **Implementation boundary:** This decision adds future compatibility only. It does not authorize capture code, a screenshot schema/store, a cadence, real data, a model/runtime, dependency, download, hardware claim, cloud fallback, spending, distribution, or deployment. Continuous screenshot capture/storage and local screenshot vision remain outside v1 unless a later approved release specification changes that scope.
- **Retained decisions:** The later feature specification must choose capture targets and cadence, retention, encryption/storage format, quotas, backups, deletion cascade, screenshot timeline/search/export behavior, sensitive-content handling, model/runtime, supported hardware, and exact API/package route. It must state honestly that local-only storage cannot guarantee a screenshot contains no password or secret.
- **Record:** `PROJECT-CHARTER.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL.md`, proposed ADR-0004, `docs/THREAT-MODEL.md`, and `tasks/todo.md`.

## Blocking before application data or live integration work

### OD-04 — Confirm historical credential rotation

- **Question:** Have the previously exposed Deepgram, Anthropic, OpenRouter, Cloudflare R2, Fly.io, RunPod, Neon, Google OAuth, and Vercel Blob credentials been revoked or rotated?
- **Blocks:** Any provider integration test using real accounts.

## Blocking before the named feature

### OD-05 — Calendar provider sequence — resolved 2026-07-18

- **Decision:** Google Calendar is required for the initial v1 launch. Outlook Calendar follows through the same provider contract and is not an initial-launch blocker.
- **Reason:** Both are feasible. Google provides the smaller first vertical slice; Microsoft adds personal/work-school account types, multitenant registration, and organization-specific consent-policy cases.
- **Record:** ADR-0002 and `docs/INTEGRATIONS-SPEC.md`.

### OD-06 — Meeting import formats

- **Choices:** Transcript text only, or transcript plus audio files.
- **Blocks:** Import adapters.

### OD-07 — Meeting audio retention

- **Question:** Is 30 days the correct default before automatic deletion, with a user override?
- **Blocks:** Meeting media schema, storage estimates, and privacy wording.

### OD-08 — Free MCP/API read scope

- **Question:** Can free users read all personal memory, or only time/activity/calendar data?
- **Blocks:** Permission scopes and public pricing promises.

### OD-09 — Daily digest tier

- **Choices:** Free with the user's key, or Pro only.
- **Blocks:** Pricing and entitlement behavior.

### OD-10 — Starter credits

- **Question:** Will Ascend fund a limited first-quality experience before a user adds a provider key?
- **Blocks:** Onboarding, cost controls, and billing design.

### OD-11 — Code-signing certificate timing

- **Choices:** Purchase during early development or during the meeting milestone.
- **Recommendation:** Decide during early development and run the installer/signing/AV spike immediately after the skeleton. No purchase is authorized merely by approving the foundation.
- **Blocks:** Signed outside-test builds and SmartScreen reputation timeline.

### OD-12 — Provider OAuth and transport boundary — resolved 2026-07-18

- **Decision:** Ascend is MCP-first with official API/webhook fallback. It registers one provider application per provider/environment where required; every user completes their own provider consent. Reusable app secrets stay in a secure Ascend connection service or provider-approved confidential boundary and are never embedded in the desktop app. User credentials are bound per actor, tenant, workspace, provider account, and environment.
- **V1 boundary:** Provider integrations remain read-only even when an MCP server advertises write tools.
- **Content path:** The connection service handles code exchange/refresh only where needed; provider task/calendar content does not pass through it by default.
- **Record:** ADR-0003 and `docs/INTEGRATIONS-SPEC.md`.

### OD-13 — Connection-service and provider provisioning approval

- **Question:** Approve the exact hosting/environment model, callback domains, provider app registrations, secrets store, token exchange/refresh design, logging/redaction, abuse controls, availability target, incident response, and cost envelope.
- **Recommendation:** Decide this during the first provider implementation slice after its provider profile and scopes are re-verified from official sources.
- **Blocks:** Creating cloud resources or provider apps, storing live credentials, and connecting a live provider account. It does not block local stack research or synthetic adapter/contract tests.

### OD-16 — Exact non-recursive NSIS installer-cache cleanup — resolved 2026-08-05

- **Decision:** The founder approved the exact proof in `docs/WINDOWS-INSTALLER-CLEANUP-PROPOSAL.md` on 2026-08-05.
- **Outcome:** The bounded current-machine proof is `go-local`. Normal uninstall removed the exact cached installer and empty directory. With an unexpected synthetic sentinel, only the cached installer was removed; the sentinel and non-empty directory survived. Install, direct-shortcut launch, `WM_CLOSE`, profile retention, reinstall, payload cleanup, and Defender checks passed.
- **Implementation boundary:** Only `build/installer.nsh` at its approved SHA-256 is allowed. Recursion, wildcards, `/REBOOTOK`, another variable/path/macro/include, signing spend, publishing, an updater, real credentials/data, outside testing, and deployment remain prohibited.
- **Progression:** The local result unblocks Task 5 specification work. It does not satisfy clean-machine, managed-environment, signing, SmartScreen, outside-testing, or public-distribution release gates.
- **Record:** `docs/reviews/NSIS-INSTALLER-CLEANUP-PROOF.md`.

### OD-21 — Installation-identity file contract

- **Question:** What exact filename and application-data path, serialized format and validation limits, Windows ACL/inheritance rules, atomic write/replace and crash-recovery behavior, and reparse-point/symlink policy will protect the random installation identity used by personal bootstrap?
- **Required scope:** Specify first-run creation, concurrent-process behavior, malformed/missing-file outcomes, backup/restore and cloned-vault handling, diagnostics redaction, uninstall retention, and deterministic tests. The decision must not derive identity from Windows account or hardware attributes.
- **Blocks:** Task 7 implementation. Recording this decision does not approve a design or authorize Task 7.
- **Record:** `docs/DATA-MODEL.md`.

### OD-18 — Future capability, runtime-isolation, visual-context, and sensitive-domain architecture

- **Question:** Approve `docs/FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL.md` and proposed ADR-0004 as the long-term seam for local/cloud AI, local transcription and LLM runtimes, CPU/GPU/NPU backends, OD-20's future local screenshot/vision capability, future meeting bots, speaker identity, and optional holistic personal modules?
- **Recommendation:** Approve capability-oriented domain boundaries, explicit execution receipts and local/cloud policy, isolated resource-bounded workers, verified model/runtime artifacts, a local-only restricted screenshot/visual-context path, capture-source-neutral meeting records, evidence-based speaker identity, and deny-by-default health/wellbeing/voice/spiritual data classes.
- **Boundary:** Approval does not select or add screenshot capture/storage, a runtime, dependency, model, model download, cloud resource, provider account, credential, external plugin system, voice profile, health schema/data, real data, spending, distribution, or deployment. Each concrete feature retains its own specification, source/license/security research, TDD, and human approval gate.
- **Blocks:** The first production feature that would otherwise couple domain code directly to a model/provider/runtime, introduce a local model worker, add a cloud meeting bot or speaker identity, or create a holistic personal data path. It does not block Milestone 0, Task 4, or pure research.
- **Approval text:** `Approved: FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL. Adopt OD-18 and ADR-0004. Preserve OD-20's future opt-in encrypted local screenshot and local-vision seam, but keep screenshot capture/storage, local-model, cloud-meeting-bot, speaker-identity, and holistic health/wellness implementation out of the current foundation; each requires a separately specified and approved release scope. Implement only the shared capability, provenance, failure, isolation, and data-class seams alongside the first relevant approved production slice; do not add a runtime, dependency, model, cloud resource, credential, real data, or external plugin system through this approval.`

### OD-19 — Agent OS, skills, tools, durable runs, and external-AI boundaries

- **Question:** Approve `docs/AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL.md` and proposed ADR-0005 as the long-term seam for Ascend to become a trusted personal agent, Agent OS, and single interface across replaceable cloud/local models, reusable skills, typed tools, connectors, and documented external-agent providers?
- **Recommendation:** Approve Ascend ownership of identity, workspace, memory, context disclosure, policy, approvals, typed execution, durable run state, verification, and audit. Keep models, skills, tools, connectors, workflows, triggers, grants, approvals, and runs separate; a skill never grants authority and model output never executes directly.
- **External-AI boundary:** Ascend using provider model APIs, an approved ChatGPT/Claude/other client using Ascend MCP/API, and Ascend invoking a documented external-agent API are separate routes with separate credentials, context, grants, and audit. Browser/UI automation, consumer-session cookies, and private endpoints are not foundational control routes.
- **Boundary:** Approval does not create or select an agent runtime, skill loader, Skills Hub, workflow engine, durable-run schema, model/provider SDK, external-agent integration, connector, provider account, credential, cloud resource, browser automation, autonomous/background behavior, third-party skill mechanism, real data, spending, distribution, or deployment. Concrete contracts and persistence remain feature-specification, current-source, security, TDD, and human-approval gated.
- **Blocks:** The first implementation of an agent profile, skill loader, workflow, trigger, durable agent run, model-directed tool, external-agent invocation, autonomous/background execution, multi-agent orchestration, or organization skill catalog. It does not block Milestone 0, Task 4, provider read-only synchronization, or pure research.
- **Approval text:** `Approved: AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL. Adopt OD-19 and ADR-0005. Treat Ascend as the trusted agent and single-interface layer; keep models, external agents, skills, tools, connectors, memory, permissions, approvals, and run state separate. Skills never grant authority, model output never executes directly, and external side effects remain typed, policy-checked, previewed, approval-gated, idempotent, verified, and audited. Do not implement an agent runtime, skill loader, autonomous workflow, external ChatGPT/Claude control, dependency, credential, cloud resource, real data, or browser/session automation through this approval.`

## Future organization decisions

These do not block the individual release but must be specified before team development:

- Cloud identity provider and local-actor account linking
- Organization and workspace hierarchy
- Invitation and domain-claim rules
- Roles and custom permissions
- Personal-to-workspace sharing semantics
- Ownership when a member leaves
- Shared storage, synchronization, conflict resolution, and offline behavior
- Billing owner, seat counting, guests, suspensions, and plan limits
- SSO, SCIM, audit export, retention, legal hold, and data residency
- Aggregated productivity reporting and employee privacy constraints
