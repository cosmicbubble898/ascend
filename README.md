# Ascend

Created by **Cosmic Bubble and Codex**. Codex is co-author of the project.

Ascend is a Windows-first productivity system for independent professionals. It combines dictation into any app, bot-free meeting notes, local productivity tracking, assigned tasks from ClickUp and Asana, Google Calendar meetings, a searchable work memory, and controlled access for tools such as ChatGPT and Claude.

Ascend begins as an individual product and is designed to grow into a team and organization platform without replacing its identity, ownership, workspace, permissions, or audit foundations.

This repository is public by founder decision. Local tools, dependencies, builds, runtime data, credentials, recordings, models, logs, crash dumps, and user data must never be committed.

## Current status

**Development started: Tasks 2 and 3 are complete. Task 4 now has documented `no-go` results for both Squirrel and standard electron-builder NSIS. OD-16 approval is required for the exact non-recursive NSIS cache-cleanup proof. No signing spend occurred.**

Task 1 research and `docs/STACK-VERSION-PROPOSAL.md` were approved on 2026-07-18. Task 2 created the verified Python quality skeleton, and Task 3 created the verified secure Electron shell and combined quality gate. Task 4's Squirrel launcher crashed and its uninstall left executable residue. The approved standard NSIS fallback then passed build, install, direct-shortcut launch, exit, payload cleanup, retention, reinstall, and Defender checks, but left a full installer at `%LOCALAPPDATA%\ascend-updater\installer.exe` after uninstall. `docs/WINDOWS-INSTALLER-CLEANUP-PROPOSAL.md` defines the separately gated fix. OD-03 selected synthetic-only plain storage; encryption remains mandatory before real activity, meeting audio, transcripts, memory, or outside testing. Signing spend, publishing an installer, an updater, real credentials, real user data, and production changes remain separately gated.

## Read first

1. `PROJECT-CHARTER.md` — product direction and organization-ready principles
2. `docs/RESEARCH-SYNTHESIS.md` — what the 50-file research corpus changes, confirms, and leaves unresolved
3. `docs/ARCHITECTURE.md` — approved component, trust-boundary, integration, and organization-ready architecture
4. `docs/SPEC.md` — proposed v1 requirements and technical boundaries
5. `docs/INTEGRATIONS-SPEC.md` — Google Calendar, ClickUp, Asana, Outlook sequencing, and OAuth boundaries
6. `docs/STACK-VERSION-PROPOSAL.md` — approved runtime and tool versions
7. `docs/WINDOWS-INSTALLER-FALLBACK-PROPOSAL.md` — OD-14 NSIS fallback recommendation and proof gates
8. `docs/reviews/NSIS-INSTALLER-PROOF.md` — exact local fallback result and supply-chain evidence
9. `docs/WINDOWS-INSTALLER-CLEANUP-PROPOSAL.md` — OD-16 exact non-recursive cleanup proof awaiting approval
10. `docs/decisions/ADR-0001-individual-first-organization-ready.md` — why tenant, workspace, and membership seams exist from day one
11. `docs/decisions/ADR-0002-v1-personal-work-integrations.md` — the v1 connected-work decision
12. `docs/decisions/ADR-0003-mcp-first-provider-integration-gateway.md` — provider MCP/API routing and credential custody
13. `docs/THREAT-MODEL.md` — assets, trust boundaries, abuse cases, and security gates
14. `docs/OPEN-DECISIONS.md` — founder decisions and when they become blocking
15. `docs/FOUNDATION-APPROVAL.md` — recorded approval and retained gates
16. `tasks/plan.md`, `tasks/todo.md`, and `tasks/integrations-plan.md` — approval-gated plans
17. `AGENTS.md` and `JUNIOR_WORKFLOW.md` — mandatory engineering process

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

The approved dependency versions and planned checks are recorded in `docs/STACK-VERSION-PROPOSAL.md`. Only the dependencies needed by the currently authorized task may be installed.

## Security boundary

Never copy donor repositories wholesale. Never commit `.env*`, API keys, credentials, local databases, recordings, models, runtime logs, or user data. Historical files are reference material, not trusted runtime inputs.

Report suspected vulnerabilities through the private process in `SECURITY.md`, not through a public issue.

## License

No open-source license has been selected yet.
