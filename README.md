# Ascend

Created by **Cosmic Bubble and Codex**. Codex is co-author of the project.

Ascend is a Windows-first personal development system whose first product wedge is dependable work productivity. It combines dictation into any app, bot-free meeting notes, local productivity tracking, assigned tasks from ClickUp and Asana, Google Calendar meetings, a searchable work memory, and controlled access for tools such as ChatGPT and Claude. Its long-term direction is a trusted personal agent and Agent OS: one Ascend interface coordinating replaceable models, reviewed skills, typed tools, connectors, and later specialist agents under Ascend-owned permissions, memory, approvals, and run history.

Ascend begins as an individual product and is designed to grow in three compatible directions: optional private modules for work, mind, body, energy, and spiritual wellbeing; a team/organization platform built only from deliberately shared or organization-owned work; and an Agent OS layer coordinating approved intelligence and actions. None may replace its identity, ownership, workspace, permissions, audit, capability, provenance, or sensitive-data boundaries.

This repository is public by founder decision. Local tools, dependencies, builds, runtime data, credentials, recordings, models, logs, crash dumps, and user data must never be committed.

## Current status

**Development started: Tasks 2 and 3 are complete. Task 4's exact non-recursive NSIS cleanup route passed its bounded current-machine proof and is `go-local` for continued foundation development. Clean-machine, signing, SmartScreen, outside-testing, and distribution gates remain open. No signing spend occurred.**

Task 1 research and `docs/STACK-VERSION-PROPOSAL.md` were approved on 2026-07-18. Task 2 created the verified Python quality skeleton, and Task 3 created the verified secure Electron shell and combined quality gate. Task 4 first returned `no-go` for Squirrel and standard NSIS. After OD-16 approval, the exact custom NSIS cleanup route passed build, install, direct-shortcut launch, exit, payload cleanup, profile retention, reinstall, normal updater-cache cleanup, sentinel preservation, and Defender checks on the current development machine. This local result unblocks Task 5 specification work but is not release evidence. The Windows hardware/permission behavior contract was approved as OD-17; its implementation still follows the recorded Milestone 0 and native-dependency gates. OD-18 proposes future capability/runtime seams without authorizing a model, runtime, bot, health module, dependency, or cloud resource. OD-19 proposes Agent OS and skills boundaries without authorizing an agent runtime, skill loader, workflow, external-AI control, provider dependency, credential, cloud resource, browser automation, or real data. OD-03 selected synthetic-only plain storage; encryption remains mandatory before real activity, meeting audio, transcripts, memory, or outside testing. Signing spend, publishing an installer, an updater, real credentials, real user data, outside testing, and production changes remain separately gated.

OD-20, recorded on 2026-08-04, preserves a future opt-in path for screenshots to be encrypted and retained locally, then analyzed only by an approved local vision/OCR worker. It changes no v1 scope and authorizes no capture code, screenshot storage, model/runtime, dependency, schema, or real data.

## Read first

1. `PROJECT-CHARTER.md` — product direction and organization-ready principles
2. `docs/RESEARCH-SYNTHESIS.md` — what the 50-file research corpus changes, confirms, and leaves unresolved
3. `docs/ARCHITECTURE.md` — approved component, trust-boundary, integration, and organization-ready architecture
4. `docs/SPEC.md` — proposed v1 requirements and technical boundaries
5. `docs/COMPETITOR-FAILURE-RESEARCH-2026-07-19.md` — public dictation, meeting, cloud, and local-runtime failure classes converted into Ascend controls
6. `docs/FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL.md` — proposed OD-18 seams for local AI, future meeting bots, speaker identity, and holistic personal modules
7. `docs/AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL.md` — proposed OD-19 agent, skill, tool, context, approval, durable-run, and external-AI boundaries
8. `docs/WINDOWS-HARDWARE-BASELINE-PROPOSAL.md` — approved OD-17 multi-monitor/device, permission, dictation-suppression, and recovery contract
9. `docs/INTEGRATIONS-SPEC.md` — Google Calendar, ClickUp, Asana, Outlook sequencing, and OAuth boundaries
10. `docs/STACK-VERSION-PROPOSAL.md` — approved runtime and tool versions
11. `docs/WINDOWS-INSTALLER-FALLBACK-PROPOSAL.md` — OD-14 NSIS fallback recommendation and proof gates
12. `docs/reviews/NSIS-INSTALLER-PROOF.md` — exact local fallback result and supply-chain evidence
13. `docs/WINDOWS-INSTALLER-CLEANUP-PROPOSAL.md` — approved OD-16 exact non-recursive cleanup boundary
14. `docs/reviews/NSIS-INSTALLER-CLEANUP-PROOF.md` — bounded current-machine `go-local` result and retained release gates
15. `docs/decisions/ADR-0001-individual-first-organization-ready.md` — why tenant, workspace, and membership seams exist from day one
16. `docs/decisions/ADR-0002-v1-personal-work-integrations.md` — the v1 connected-work decision
17. `docs/decisions/ADR-0003-mcp-first-provider-integration-gateway.md` — provider MCP/API routing and credential custody
18. `docs/decisions/ADR-0004-capability-oriented-modular-runtime-boundaries.md` — proposed OD-18 capability, runtime-isolation, and data-class decision
19. `docs/decisions/ADR-0005-agent-os-skill-tool-and-external-ai-boundaries.md` — proposed OD-19 Agent OS authority and interoperability decision
20. `docs/THREAT-MODEL.md` — assets, trust boundaries, abuse cases, and security gates
21. `docs/OPEN-DECISIONS.md` — founder decisions and when they become blocking
22. `docs/FOUNDATION-APPROVAL.md` — recorded approval and retained gates
23. `tasks/plan.md`, `tasks/todo.md`, and `tasks/integrations-plan.md` — approval-gated plans
24. `AGENTS.md` and `JUNIOR_WORKFLOW.md` — mandatory engineering process

## Source-of-truth order

When documents conflict, use this order:

1. Observed behavior and test evidence
2. `PROJECT-CHARTER.md`
3. Approved sections of `docs/SPEC.md`
4. Accepted ADRs under `docs/decisions/`
5. `tasks/plan.md` and `tasks/todo.md`
6. Historical handover and donor material listed in `docs/REFERENCE-SOURCES.md`

Reality may override a document, but the document and decision record must be updated before implementation continues.

## Planned architecture

- Thin Electron/TypeScript shell for tray, supervision, windows, and overlays
- Hidden Python engine for capture, transcription, memory, productivity, API, and MCP; CPython 3.13.14 is the approved and locked foundation runtime
- Native Windows helper processes only where Windows APIs require them
- A single data-access layer owning a local SQLite database
- A personal tenant, personal workspace, and local actor from the first migration
- Bring-your-own-key cloud services for quality transcription and AI writing
- Local processing for memory, activity tracking, focus calculations, and basic offline dictation
- A deterministic provider-neutral integration gateway: official MCP first when production-suitable, official API/webhook fallback, and read-only local tool allowlists for v1
- Separate inbound Ascend MCP/API access and outbound provider MCP/API connections; credentials and permissions never cross those boundaries
- A separately approved secure connection service for reusable provider app secrets and confidential OAuth exchange/refresh; provider content stays out of that service by default
- Versioned capability contracts that keep product modules independent from a cloud service, local model, capture source, or hardware backend
- A future opt-in local visual-context seam that keeps accessibility metadata, transient OCR frames, retained encrypted screenshots, and derived observations distinct; raw pixels have no implicit cloud route and local vision/OCR runs in an isolated network-denied worker
- Future native/model runtimes isolated in supervised, resource-bounded workers with no direct database, credential, MCP, or unrelated workspace access
- Explicit local/cloud execution policy and provenance; local-only data never falls back to cloud silently
- Separate deny-by-default data classes for future health, wellbeing, voice identity, and spiritual-reflection data
- A proposed application-owned Agent OS boundary: Ascend owns identity, minimum-context disclosure, policy, approvals, durable runs, typed execution, verification, and audit while models and external agents remain replaceable
- Proposed versioned skills as reviewed instruction/resource bundles that never grant permissions or receive credentials
- Proposed typed tool execution with exact risk review, approval binding, idempotency, reconciliation, verification, and receipts; no direct model-to-side-effect path
- Separate provider-model calls, inbound Ascend MCP/API clients, and outbound documented external-agent APIs; browser/session/private-endpoint ChatGPT or Claude control is not a foundational route

The approved dependency versions and planned checks are recorded in `docs/STACK-VERSION-PROPOSAL.md`. Only the dependencies needed by the currently authorized task may be installed.

## Security boundary

Never copy donor repositories wholesale. Never commit `.env*`, API keys, credentials, local databases, recordings, models, runtime logs, or user data. Historical files are reference material, not trusted runtime inputs.

Report suspected vulnerabilities through the private process in `SECURITY.md`, not through a public issue.

## License

No open-source license has been selected yet.
