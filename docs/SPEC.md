# Specification: Ascend Version 1

**Status:** Foundation architecture and stack proposal approved; OD-17 hardware behavior approved; OD-18 future-capability and OD-19 Agent OS extensions proposed; Tasks 2–4A complete locally; release gates remain open
**Last updated:** 2026-08-10

## Approved foundation and remaining gates

1. Version 1 is a Windows-only, local-first product for one individual.
2. The approved runtime direction is a thin Electron/TypeScript shell supervising a hidden Python engine. CPython 3.13.14 and the exact Task 2 Python quality dependencies are locked through `docs/STACK-VERSION-PROPOSAL.md`, `pyproject.toml`, and `uv.lock`.
3. Quality speech-to-text and AI writing use providers chosen by the user with the user's own keys.
4. Basic offline dictation, memory, activity tracking, and focus calculations run locally.
5. A personal tenant/account, personal workspace, local actor, membership, ownership, and permission seams exist from the first migration, but team collaboration itself is deferred.
6. Provider keys remain DPAPI-protected. OD-03 allows plain storage only for synthetic development data; encryption is mandatory before real work activity, meeting audio, transcripts, memory, or outside testing.
7. Initial v1 includes personal read-only Google Calendar, ClickUp, and Asana connections. Outlook Calendar is the next provider, not an initial-launch blocker.
8. Provider integrations use an MCP-first gateway with official API/webhook fallback. Google Calendar and Outlook may use their stable APIs first while official MCP services remain preview-stage.
9. OD-17 approves the Windows hardware and permission behavior contract. Native dependencies, real capture/data, and hardware implementation remain separately gated.
10. OD-18 proposes capability, provenance, runtime-isolation, capture-source, and sensitive-data-class seams. It does not authorize a local model, runtime, meeting bot, speaker-identity feature, health/wellness module, dependency, or cloud resource.
11. OD-19 proposes the long-term Agent OS boundary between models, external agents, skills, tools, connectors, context, permissions, approvals, and durable runs. It does not authorize an agent runtime, skill loader, autonomous workflow, external-AI control, browser/session automation, dependency, credential, cloud resource, or schema.
12. OD-20 preserves a future opt-in path for encrypted local screenshot retention and local vision/OCR analysis. It does not authorize screenshot capture, storage, a model/runtime, a dependency, a schema, real data, or cloud screen processing, and it does not move continuous screenshots into v1.

Items 1, 2, 5, 6, 7, 8, 9, and 12 are approved product/architecture directions. Item 10 remains proposed until OD-18 is approved, and item 11 remains proposed until OD-19 is approved. OD-20 approves only future compatibility, not implementation. OD-03 permits migration development with synthetic data after the exact data-model specification is approved; it still blocks all sensitive real data until encryption is implemented and proven. OD-04 blocks live provider testing.

### Audit remediation gate

The 2026-08-05 foundation audit found stale security-pinned runtimes, installer-policy and evidence-binding gaps, a broken default project-local Python-toolchain route, and privacy/documentation overclaims. The exact local-only remediation passed on 2026-08-10; current evidence is in `docs/reviews/AUDIT-REMEDIATION-2026-08-10.md`.

The exact approved scope, dependency versions, TDD order, acceptance criteria, and stop conditions are in `docs/AUDIT-REMEDIATION-PROPOSAL.md`. Completion does not broaden any product, data, release, signing, publishing, provider, model, screenshot, agent, or Task 6 gate.

## Objective

Build a dependable Windows productivity system that helps an independent professional:

- Speak text into any application
- Capture useful meeting notes without a meeting bot
- Understand where work time goes
- Build a searchable and correctable memory of work
- See current assigned ClickUp/Asana tasks and upcoming Google Calendar meetings
- Let approved tools read that memory and suggest additions through a reviewable inbox

Success means a new user can install Ascend, configure a provider key or use the limited offline mode, connect approved personal work accounts, see assigned tasks and upcoming meetings, dictate into common applications, obtain useful notes from real meetings, review a week of activity, search their work memory, and control every external read or proposed write.

## Users and tenancy direction

The initial user is an individual Windows professional. The long-term system must support multiple organization accounts, multiple workspaces per account, multiple memberships per person, and tenants ranging from one person to hundreds of members.

The individual user's account is modeled as a personal tenant with a personal workspace from day one. Personal capture remains private unless deliberately shared. In product language, an organization is a multi-member tenant account. Every personal or professional subject represented inside memory is a separate memory entity/context, not a tenant or authorization principal. This includes—but is not limited to—people, relationships, family, organizations/clients, projects, topics, goals, habits, places, events, health/wellbeing domains, and life areas. See `PROJECT-CHARTER.md` and ADR-0001.

## Version 1 functional scope

### 1. Dictation

- A configurable shortcut starts and stops microphone capture.
- Ascend enumerates multiple microphones by opaque Windows endpoint identity, supports `system_default` or a pinned device, and never silently substitutes a different pinned microphone.
- With playback suppression enabled, dictation snapshots and mutes all active render endpoints before opening the microphone. A newly active output pauses capture visibly until its mute is verified or the user explicitly overrides suppression, and the resulting capture gap is recorded.
- Ascend uses endpoint mute rather than setting volume to zero, verifies the result, preserves already-muted outputs, and restores only mute state it changed with no observed ownership conflict. Core Audio same-value and final read/write races remain explicit residual limitations.
- Verified Windows mute state is not called proven physical silence when an exclusive-mode path remains possible; the indicator shows the limitation instead of overstating success.
- If suppression cannot be verified, dictation does not silently continue. The user sees the affected output and can retry, cancel, or explicitly continue that one dictation without suppression.
- Stop, cancel, device loss, engine failure, shutdown, and restart recovery converge on one idempotent restoration path. Audio restoration does not wait for transcription.
- Dictation never continues without its authoritative visible indicator. Indicator failure, workstation lock, or session transition stops capture and restores outputs visibly.
- Windows virtual-desktop, cloaking, exclusive-fullscreen, and secure-desktop cases fail closed when indicator visibility cannot be proven.
- Quality mode streams speech to a user-selected provider and displays partial text.
- Offline mode works without a provider key, is honestly labeled, and may return text only after capture stops.
- Final text lands in the application that held focus, using a guarded clipboard-swap flow.
- Focus changes, busy clipboard failures, device failures, and provider failures surface visibly.
- Five rebindable transforms operate on dictated or selected text: improve English, rephrase, formalize, summarize, and translate.
- A failed transform returns the original text unchanged.
- Exact multi-device, multi-display, capability, mute-ownership, recovery, and hardware-test behavior is defined in the approved OD-17 `docs/WINDOWS-HARDWARE-BASELINE-PROPOSAL.md`; implementation remains behind its recorded task and dependency gates.

### 2. Bot-free meeting notes

- Ascend never joins a call as a bot.
- Meeting-system audio and the user's microphone are captured as separate tracks.
- Recording requires an explicit user action or confirmation and always shows a visible indicator.
- The transcript distinguishes the user from everyone else by construction.
- Additional speaker separation and names are useful but not launch-blocking.
- A completed meeting can produce a transcript, summary, decisions, and bidirectional action items.
- Capture gaps and degraded tracks are recorded and shown; no silent failure is permitted.

### 3. Productivity tracking

- Ascend records foreground application/window activity with idle detection.
- Explicit application and window exclusions are enforced before persistence. Provider-aware best-effort filtering suppresses detectable private contexts and password/secret fields; when required detection is unavailable or ambiguous, capture fails closed for that source. The UI discloses the residual risk that accessibility metadata can be incomplete or wrong, so Ascend cannot guarantee that every secret is impossible to capture.
- Activity is attributed to projects and clients through user-correctable rules.
- Focus calculations are deterministic and explainable.
- Daily or weekly AI-written insights receive aggregates and approved context, not raw unrestricted activity.
- The application window may close while the engine continues tracking from the tray.

### 4. Work memory

- Dictations, meetings, activity, notes, people, relationships, organizations/clients, projects, topics, goals, habits, events, promises, personal contexts, and imports can form one searchable local memory under explicit sensitivity, ownership, and visibility rules.
- Raw events remain append-only.
- Derived facts are rebuildable and record source, confidence, model, and prompt version where applicable.
- User corrections survive rebuilds and override lower-confidence inference.
- Deletion destroys content while preserving a minimal gravestone identifier where required for references and future synchronization.

### 5. Personal work integrations

- Google Calendar is required for the initial v1 launch. Users explicitly select calendars and see today's/upcoming events and meeting links.
- ClickUp and Asana are required initial-v1 task providers. Ascend imports only open tasks assigned to the authenticated person in explicitly authorized provider workspaces.
- The initial field set is minimized and source-linked. Task descriptions/comments/attachments/custom fields and event descriptions/attachments are excluded by default.
- Connections are personal, read-only, off until authorized, revocable, and private to the personal workspace.
- Sync is paginated, idempotent, bounded, rate-limit aware, cancellable, and visibly stale on failure.
- Disconnect removes credentials and stops future calls immediately; local imported-history deletion is an explicit user choice.
- Outlook Calendar uses the same provider contract after Google is proven, but is not an initial-launch blocker.
- Provider connections use the approved MCP-first/API-fallback gateway. MCP transport does not replace deterministic synchronization, canonical normalization, or API/webhook fallback.
- Ascend creates provider app registrations once per provider/environment where required; each user completes their own provider OAuth consent.
- No reusable provider client secret may be embedded in the desktop application. A security-reviewed connection service handles confidential code exchange/refresh where required, without carrying provider content by default.
- Provider-advertised write tools remain unreachable in initial-v1. Future writes require a separate preview, explicit-confirmation, idempotency, and audit specification.
- Detailed behavior, fields, security cases, success criteria, and current official sources are in `docs/INTEGRATIONS-SPEC.md`, ADR-0002, and ADR-0003.

### 6. Open connections

- A versioned local API and Ascend MCP server allow explicitly approved clients to read permitted memory.
- This inbound Ascend interface is separate from Ascend acting as an outbound MCP client for connected providers. Their grants, tools, credentials, and audit trails cannot be reused or conflated.
- External writes create pending inbox items; they never modify memory directly.
- Access is off by default, scoped per client, revocable, and audited.
- Voice embeddings, secrets, and excluded private content are never exposed through API, MCP, export, or logs.
- Imported documents, retrieved text, provider responses, and LLM output are treated as untrusted. Model output cannot directly execute SQL, shell commands, filesystem operations, HTML, permission changes, or external actions.
- Inputs, outputs, file sizes, token use, retries, request rates, and background work are bounded.

## Explicitly outside version 1

- Team invitations and shared cloud workspaces
- Organization administration, manager dashboards, employee rankings, and productivity leaderboards
- Centralized billing, SSO, SCIM, and enterprise retention policy
- Mac or Linux applications
- Meeting bots or kernel-level audio drivers
- Continuous screenshot capture/storage, local screenshot-vision implementation, or cloud screen vision; OD-20 preserves only a future local-only architecture seam
- Voice-command control of the computer
- GPU transcription as a default path
- A bundled local LLM for writing
- Production cloud synchronization
- Outlook Calendar in the initial launch; it is planned as the next calendar provider
- Creating, updating, completing, reassigning, or deleting provider tasks or calendar events
- A calendar-triggered cloud meeting bot
- Automatic or biometric speaker naming
- Health, wellness, mind, body, energy, or spiritual-reflection modules
- An Agent OS runtime, Skills Hub, skill loader, autonomous workflow, scheduled/background agent, or multi-agent orchestration
- Ascend remotely controlling arbitrary existing ChatGPT or Claude consumer chats
- Browser/UI automation, consumer-session-cookie reuse, or reverse-engineered private endpoints as an external-AI integration route
- Agent-initiated task, calendar, email, message, file, permission, financial, recording, or device side effects

No local model or model runtime is selected or authorized by the current foundation. Any local transcription or language-model path—including Parakeet-family, llama.cpp-family, CUDA, DirectML, Windows ML, GPU, or NPU execution—requires a separately approved feature specification, current dependency/license/security research, and hardware proof. This retained gate does not prejudge whether a later approved local path belongs in v1 or a later release.

## Future-capability compatibility requirements

The following are foundation constraints, not implemented v1 features, until OD-18 and a relevant feature specification are approved:

- Product modules request versioned capabilities rather than importing a specific model, provider SDK, native library, or hardware backend.
- Every result includes an execution receipt with adapter/runtime, model or service, local/cloud route, device/backend class, timing, provenance, and typed failure/degradation state.
- Local-only requests never fall back to cloud silently. A locality change requires explicit policy and visible authorization.
- Dependency-heavy or driver-sensitive inference runs in a supervised, resource-bounded worker without direct database, credential-store, MCP, or unrelated workspace access.
- Model/runtime artifacts are pinned, hash-verified, license-recorded, quarantined before activation, rollback-capable, and forbidden from running arbitrary remote model code.
- One resource governor limits CPU, RAM, disk, GPU/NPU memory, battery, thermal load, queues, and concurrency; real-time capture outranks background inference.
- Canonical meeting records remain capture-source neutral while retaining the actual source, consent, participant, completeness, and timing evidence.
- Diarization and speaker identity remain separate. Unknown speakers stay unknown unless typed evidence and user correction support a name.
- Health, wellbeing, voice-identity, and spiritual-reflection data are deny-by-default for work search, organization access, analytics, API, MCP, export, diagnostics, and unrelated AI context.
- Future screen context keeps accessibility metadata, transient OCR frames, retained screenshots, and derived visual observations as distinct capture and data types.
- Retained screenshots and raw pixels are local-only. A missing, failed, or unsupported local vision path fails closed and never routes the image to cloud automatically.
- Screenshot capture is off by default and requires visible, pauseable, target-scoped controls plus pre-capture exclusions, explicit cadence, storage quota, retention, deletion, and backup behavior.
- Real screenshots require proven encrypted storage. Raw screenshots and derived visual context remain personal and are denied from organization access, general API/MCP/export, diagnostics, and unrelated AI context by default.
- A local vision/OCR worker receives only brokered asset handles, has no network/database/credential/MCP authority, and returns untrusted derived output with capture/model provenance, confidence, and correction state.
- New adapters pass one common conformance and fault-injection suite. Arbitrary third-party plugins require a separate security design and ADR.

## Future Agent OS compatibility requirements

The following are proposed foundation constraints, not implemented v1 features, until OD-19 and a relevant agentic feature specification are approved:

- Ascend owns identity, tenant/workspace scope, memory, context disclosure, policy, approvals, durable run state, typed execution, verification, and audit. Models and external agents remain replaceable providers.
- A skill is a versioned, reviewable instruction/resource bundle. It can declare needed tools and data classes but cannot grant authority, receive credentials, install code, or execute itself.
- Model text and structured tool calls are untrusted proposals. No free-form model output becomes SQL, shell, filesystem, browser, permission, device, or provider action.
- Skills, tools, connectors, models, external agents, agent profiles, workflows, triggers, runs, grants, approvals, and execution receipts remain separate types and lifecycle concepts.
- Effective authority is the intersection of actor/membership, tenant/workspace, data-class/purpose, connector, operation, agent-profile, trigger-mode, approval, lifetime, and budget policies.
- A context broker sends only the minimum approved data to each model, skill, tool, or external agent and records provider, purpose, data classes, retention/disclosure policy, and provenance.
- Every side effect passes through one typed gateway with schema validation, canonical targeting, policy evaluation, exact preview when required, approval binding, idempotency, result validation, verification, and audit.
- Every run has durable actor/workspace context, selected versions, policy snapshot, budgets, disclosures, checkpoints, approvals, calls, receipts, verification state, cancellation, and terminal status.
- A timeout or crash never proves a write did not occur. Resume logic reconciles uncertain outcomes before retrying.
- Human approval binds the exact actor, run, tool, target, arguments/diff, disclosure, risk, policy, cost, and expiry. Material changes invalidate it.
- Manual, scheduled, and event triggers grant no permission. Background runs use stricter policy than interactive runs and never interpret silence as consent.
- Personal, workspace, and organization-owned skills, agents, schedules, runs, grants, and memory have explicit ownership and are private by default. Sharing, installation, activation, and invocation are distinct.
- Ascend using OpenAI/Anthropic or local model APIs, an approved external client using Ascend MCP/API, and Ascend invoking an official external-agent API remain separate routes with isolated credentials, grants, context, and audit.
- Browser/UI automation, consumer-session cookies, private endpoints, and reverse-engineered control of ChatGPT or Claude are not foundational routes.
- Begin with one responsible coordinator. Specialist agents are bounded typed tools; handoffs, parallel agents, recursion, and agent-created agents require separate policy, budgets, cancellation, and proof.
- Do not add speculative agent, skill, workflow, trigger, or run tables to migration 0001. Add only the minimum persistence with the first separately approved agentic vertical slice.

The detailed proposed boundary and exact approval text are in `docs/AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL.md`, OD-19, and proposed ADR-0005.

## Tenant- and organization-ready data requirements

The first schema must support, at minimum, stable identifiers for a local actor, personal tenant, personal workspace, workspace membership, device, and owned records. Every user-owned or shareable record must have explicit owner, tenant, and workspace scope. Every data-access operation must receive tenant and workspace context, including local v1 operations.

Membership roles are not hard-coded into the person. Permission evaluation must be separable from UI rendering. Important operations must record actor, device/client, tenant, workspace, source, and UTC time. Data ownership must distinguish personal, explicitly shared, workspace-owned, and organization-owned content.

Conceptual terminology is mandatory. The exact migration-0001 proposal is now in `docs/DATA-MODEL.md` and remains subject to founder approval before implementation:

- **Tenant:** the personal or organization account boundary used for ownership, administration, billing, and authorization.
- **Workspace:** the primary data scope owned by one tenant.
- **Workspace membership:** the relationship carrying an actor's role in a workspace.
- **Memory entity/context:** any personal or professional subject represented inside memory. Examples include a person, relationship, family item, organization/client, project, topic, goal, habit, place, event, health/wellbeing domain, or life area. It is user data, not an account or authorization principal.

An ambiguous `organization` model or `organization_id` field must not represent both a tenant account and an organization/client represented in memory. The same type and ID separation applies to every other memory entity/context.

Exact tables, constraints, and future cloud identity mapping require a separately reviewed data-model specification before migration 0001 is implemented.

## Proposed technical architecture

- **Shell:** Electron with TypeScript; resident main process for tray and supervision; renderer created on demand. The renderer uses context isolation, sandboxing, no Node integration, a narrow typed preload bridge, sender-validated IPC, and no remote content by default.
- **Engine:** Python process, single instance, loopback-only HTTP/WebSocket, random port, per-session bearer token. The approved foundation runtime is CPython 3.13.14.
- **Native helpers:** Small signed sidecars only for Windows behavior without a reliable Python path, beginning with meeting process-loopback capture.
- **Storage:** SQLite opened only by the engine through one data-access layer; numbered migrations from the first schema.
- **Search:** Local full-text search first; embeddings are deferred until evidence requires them.
- **Integration gateway:** Provider-neutral profiles route deterministic requests through official MCP where production-suitable and through official APIs/webhooks as fallback. Canonical task/event behavior, permissions, synchronization, and audit do not depend on transport.
- **Cloud:** Task/calendar content calls go directly from the engine to user-authorized providers by default. A minimal security-reviewed Ascend connection service holds provider app secrets and performs confidential OAuth code exchange/refresh where required; provider content is not in that service's default path.
- **Proposed capability boundary:** Domain modules call versioned capability contracts. Concrete cloud/local/native adapters are replaceable, return execution receipts, and use supervised isolated workers when their dependencies or drivers would increase the engine's blast radius. No concrete runtime is selected through this seam.
- **Future visual context:** An opt-in Windows capture adapter may later retain encrypted screenshots locally and pass brokered handles to an isolated, network-denied local vision/OCR worker. Raw pixels, derived observations, and disclosure policy remain separate; no concrete capture API, cadence, storage format, model, or runtime is selected through this seam.
- **Proposed Agent OS boundary:** An application-owned coordinator composes reviewed skills, minimum approved context, replaceable model/external-agent providers, and typed tools under deterministic policy and durable run state. Skills never grant authority and providers never execute directly against Ascend or connected systems.

The dependency/version research and choices in `docs/STACK-VERSION-PROPOSAL.md` are approved. Installation remains task-scoped: Task 2 authorizes only its Python foundation dependencies.

Security design and residual risks are defined in `docs/THREAT-MODEL.md`. A feature crossing a trust boundary must add abuse-case tests before implementation is accepted.

Personal provider behavior and OAuth constraints are defined in `docs/INTEGRATIONS-SPEC.md` and ADR-0003. Exact provider routes, scopes, tool allowlists, app registrations, callback behavior, SDKs, connection-service design, and token lifecycle must be refreshed from official sources and approved before implementation or account creation.

The Electron/Python split and exact proposed foundation versions are approved through the architecture and stack proposal. Changing the split, versions outside a scoped update, or its trust boundaries requires current-source review and founder approval.

## Risk-first development sequence

- Build only the reproducible skeleton before testing distribution risk.
- Run an early installer/signing/SmartScreen/antivirus spike; purchasing a certificate or service requires separate approval.
- Complete Milestone 0 before product features.
- Implement the approved Windows hardware/capability contract before production dictation, meeting capture, or screen overlays depend on hardware assumptions.
- Resolve OD-18 before a production feature adds the proposed shared capability/runtime or sensitive-data-class seams; implement only the minimum seam needed by that approved vertical slice.
- Resolve OD-19 before implementing any agent profile, skill loader, workflow, trigger, durable agent run, model-directed tool use, external-agent invocation, or autonomous/background behavior. Add only the minimum contract needed by an approved vertical slice.
- Run the meeting-capture spike as throwaway experimental code. Test Meet, Zoom, and Teams across headphones, speakers, Bluetooth, silence, and device changes; include track meters, honest degradation, and echo-cancellation evidence.
- Run the first screen-context spike as throwaway experimental code on multiple Windows machines and common applications. Compare accessibility metadata with transient local OCR, verify task-level usefulness, resource usage, password-field exclusion, ignore rules, and honest coverage gaps. Retained screenshots and local vision require a later separately approved OD-20 slice after encryption and model/runtime gates.
- Before production onboarding or dictation positioning, run a first-hour/BYOK usability study. Test zero-key value, honest offline-mode expectations, provider-key setup, failure recovery, and the OD-10 starter-credit decision.
- Do not move spike code into the product tree without a separately approved production specification, behavioral tests, and normal quality/security review.

## Developer commands

Task 2 established the Python developer interface below. All commands run from the project root and use the committed lockfile.

```powershell
# Install and reproduce the approved project-local Python development environment
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-python.ps1

# Complete Python quality gate
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-python.ps1

# Install the exact project-local Node build host, then reproduce Node dependencies
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-node.ps1
.\.tools\node-v22.23.2-win-x64\npm.cmd ci --ignore-scripts

# Complete Python and TypeScript quality gate
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1

# Focused scaffold test through the exact managed environment
.\runtime\python-env-0.11.29\Scripts\python.exe -m pytest tests/test_scaffold.py -q

# Hardened unpacked Electron/Python package (not an installer)
.\.tools\node-v22.23.2-win-x64\npm.cmd run package
```

Task 4's Squirrel proof failed and its maker/default `make` command were removed. OD-14's exact unsigned standard-NSIS proof then passed the tested application lifecycle but failed uninstall cleanup because electron-builder retained `%LOCALAPPDATA%\ascend-updater\installer.exe`. After OD-16 approval, one exact non-recursive custom uninstall include passed the bounded current-machine proof: normal cleanup removed the cached installer and empty directory, while an unexpected sentinel survived and prevented directory removal. The result is `go-local` for continued synthetic-data foundation work. It is not clean-machine, signing, SmartScreen, outside-testing, or release evidence; signing still requires separate approval before spend. See `docs/reviews/NSIS-INSTALLER-CLEANUP-PROOF.md`.

## Proposed project structure

```text
src/ascend_engine/  Packaged Python engine and future domain modules
shell/              Electron main process, preload, and renderer code
native/             Isolated Windows helper projects
tests/              Python behavioral and integration tests
shell/**/*.test.ts  Shell tests near the behavior they cover
scripts/            Reproducible developer and quality-gate scripts
docs/               Specification, decisions, security, and task context
tasks/              Approved implementation plan and checklist
reference/          Explicitly approved, secret-scanned donor excerpts only
```

## Code style

- Keep domain behavior independent of FastAPI, Electron, and Windows adapters where practical.
- Prefer small typed functions and explicit data structures over implicit dictionaries or global state.
- Use names that describe product behavior, such as `workspace_id`, `recording_indicator_gap`, or `pending_inbox_item`.
- Comments explain non-obvious reasons and safety constraints, not the visible code.
- Keep files under roughly 300 lines where practical; split by responsibility rather than arbitrary size.
- Use Python type annotations for production functions and strict TypeScript settings.

## Testing strategy

- Production behavior follows test-driven development.
- Python uses pytest for domain behavior, migrations, data-access scope, engine API, and pipeline integration.
- TypeScript uses Vitest for supervisor, identity, IPC, and UI state behavior.
- Permission and tenant/workspace-isolation tests are required even when only one local tenant and workspace exist.
- Tests must prove that tenant-account IDs cannot be confused with any personal or professional memory-entity/context ID.
- Shell tests must enforce renderer sandbox/context-isolation settings and reject unknown or wrong-sender IPC messages.
- Integration tests must cover MCP capability/schema drift, local tool allowlisting, API fallback equivalence, OAuth state/callback/replay, credential redaction, provider identity, assignee filtering, pagination, rate limits, stale data, revocation, disconnect, prompt injection, and external-ID/tenant isolation.
- Windows-specific capture, clipboard, audio-device, hotkey, tray, update, and installer behavior needs automated adapter tests where possible plus documented tests on Windows.
- Audio tests must cover duplicate device names, stable opaque IDs, all active outputs, default-role changes, endpoint hot-plug, already-muted outputs, external/user mute changes, partial failures, idempotent restoration, stale recovery leases, and real multi-device hardware evidence.
- Audio ownership tests must distinguish an external mute-state change from a volume-only change, test callbacks before/during/after restoration, verify post-restore read-back, and preserve the explicit unobservable same-value/final-race limitation.
- Display tests must cover one through six plus a higher synthetic count, negative coordinates, mixed DPI, taskbar/work-area changes, primary changes, hot-plug, docking, RDP/virtual/headless displays, invalid/unified display IDs, focused-target placement, and saved windows whose original display disappeared.
- Each feature specification must select relevant rows from `docs/COMPETITOR-FAILURE-RESEARCH-2026-07-19.md` and convert them into deterministic state-machine, fake-adapter, fault-injection, supported-environment, recovery-copy, and content-free diagnostic tests.
- Future runtime tests must cover missing/incompatible drivers or DLLs, corrupt/untrusted artifacts, out-of-memory and disk pressure, cancellation, worker crash/hang, version rollback, concurrent capture, and denied local-to-cloud fallback.
- Future meeting-bot and identity tests must cover wrong/duplicate meetings, waiting rooms, admission timeout, revoked calendar access, recurrence/time-zone changes, consent, partial artifacts, anonymous/renamed participants, conflicting evidence, and durable correction.
- Future agent tests must cover skill tampering/version changes, prompt-injected authority, context over-disclosure, unknown or smuggled tool arguments, cross-run approval replay, duplicate/uncertain writes, forged or repeated triggers, recursion/cost exhaustion, cancellation, external-agent context isolation, and personal-versus-organization skill/run visibility.
- A full quality-gate script must stop on the first failed command and report skipped checks honestly.

## Boundaries

### Always

- Read relevant specifications and existing patterns first.
- Use stable IDs, workspace scope, source/provenance, UTC timestamps, and migrations.
- Validate inputs and paths at boundaries.
- Keep external writes pending until user acceptance.
- Keep remote telemetry off by default. Any future remote diagnostics require an approved specification, explicit user choice, a content-free field allowlist, and a visible disable control.
- Run focused tests and relevant broader checks before completion.

### Ask first

- Schema, public API, permission, privacy, retention, or ownership changes
- Adding or upgrading dependencies
- Creating accounts, cloud resources, credentials, or recurring cost
- Copying additional donor material into the project
- Adding screenshot capture/retention, a screen-vision path, a model/runtime artifact, executable model code, native/GPU backend, cloud meeting bot, voice profile, or health/wellness data path
- Adding an agent runtime, skill loader/catalog, workflow or scheduler, durable-run schema, model-directed tool, external-agent invocation, autonomous/background behavior, multi-agent orchestration, or browser/session control route
- Committing, pushing, publishing, or deploying

### Never

- Commit or expose secrets or user content
- Copy donor repositories wholesale
- Open the database outside the engine data-access layer
- Treat one local user as an excuse to omit ownership and workspace scope
- Expose private employee activity to an organization by default
- Use any memory entity/context—including an organization/client—as a tenant account, membership, or authorization identity
- Build employee rankings, productivity leaderboards, or hidden manager monitoring
- Suppress errors or weaken tests to claim success
- Fall back from a local-only request to cloud without explicit policy and visible authorization
- Route a retained screenshot or raw screen pixels to cloud, general API/MCP/export, organization access, diagnostics, or unrelated AI context by default
- Give a runtime worker direct database, credential-store, inbound/outbound MCP, or unrelated workspace access
- Let health, wellbeing, voice-identity, or spiritual-reflection data inherit work or organization visibility
- Let a skill, prompt, provider response, model, external agent, or retrieved content grant permission or execute directly
- Retry an uncertain external side effect without idempotency or reconciliation
- Use browser/UI automation, consumer-session cookies, or private endpoints as foundational ChatGPT/Claude control
- Make personal agents, skills, schedules, runs, connector grants, or memory organization-visible by default

## Version 1 success criteria

- A clean Windows machine can install, start, update, and uninstall Ascend without orphan processes or lost user data.
- Dictation works in Word, a browser, and a chat application; failures preserve the user's words and surface visibly.
- Real Meet, Zoom, and Teams calls produce two usable tracks and useful notes without a bot.
- After a normal workweek, the productivity view explains time allocation and focus using correctable local data.
- The memory can answer questions about meetings, projects, people, and commitments with traceable sources.
- An approved MCP/API client can read only its granted scope and can write only through the pending inbox.
- Connected Google Calendar events and the authenticated person's assigned ClickUp/Asana tasks appear with correct source links, timestamps, and visible sync state.
- No provider write is reachable in initial-v1 and no reusable provider client secret is embedded in distributed artifacts.
- A user can connect an initial provider through the provider's own consent page without entering developer credentials; grants and tokens remain isolated per actor, tenant, workspace, provider account, and environment.
- Automated tests prove workspace isolation, permission enforcement, migrations, raw/derived separation, and external-write gating.

## Open questions

See `docs/OPEN-DECISIONS.md`. Blocking items must be resolved before their named milestone; no agent should guess them.
