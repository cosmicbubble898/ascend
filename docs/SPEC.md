# Specification: Ascend Version 1

**Status:** Foundation architecture and stack proposal approved; Tasks 2 and 3 complete; Task 4's exact unsigned NSIS fallback proof approved on 2026-07-19 and in progress
**Last updated:** 2026-07-19

## Approved foundation and remaining gates

1. Version 1 is a Windows-only, local-first product for one individual.
2. The approved runtime direction is a thin Electron/TypeScript shell supervising a hidden Python engine. CPython 3.13.14 and the exact Task 2 Python quality dependencies are locked through `docs/STACK-VERSION-PROPOSAL.md`, `pyproject.toml`, and `uv.lock`.
3. Quality speech-to-text and AI writing use providers chosen by the user with the user's own keys.
4. Basic offline dictation, memory, activity tracking, and focus calculations run locally.
5. A personal tenant/account, personal workspace, local actor, membership, ownership, and permission seams exist from the first migration, but team collaboration itself is deferred.
6. Provider keys remain DPAPI-protected. OD-03 allows plain storage only for synthetic development data; encryption is mandatory before real work activity, meeting audio, transcripts, memory, or outside testing.
7. Initial v1 includes personal read-only Google Calendar, ClickUp, and Asana connections. Outlook Calendar is the next provider, not an initial-launch blocker.
8. Provider integrations use an MCP-first gateway with official API/webhook fallback. Google Calendar and Outlook may use their stable APIs first while official MCP services remain preview-stage.

Items 1, 2, 5, 6, 7, and 8 are approved product/architecture decisions. OD-03 permits migration development with synthetic data after the exact data-model specification is approved; it still blocks all sensitive real data until encryption is implemented and proven. OD-04 blocks live provider testing.

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

The individual user's account is modeled as a personal tenant with a personal workspace from day one. Personal capture remains private unless deliberately shared. In product language, an organization is a multi-member tenant account. A client/company mentioned inside work memory is a work entity, not a tenant. See `PROJECT-CHARTER.md` and ADR-0001.

## Version 1 functional scope

### 1. Dictation

- A configurable shortcut starts and stops microphone capture.
- Quality mode streams speech to a user-selected provider and displays partial text.
- Offline mode works without a provider key, is honestly labeled, and may return text only after capture stops.
- Final text lands in the application that held focus, using a guarded clipboard-swap flow.
- Focus changes, busy clipboard failures, device failures, and provider failures surface visibly.
- Five rebindable transforms operate on dictated or selected text: improve English, rephrase, formalize, summarize, and translate.
- A failed transform returns the original text unchanged.

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
- Excluded applications, private contexts, and password fields are blocked at the capture source before persistence.
- Activity is attributed to projects and clients through user-correctable rules.
- Focus calculations are deterministic and explainable.
- Daily or weekly AI-written insights receive aggregates and approved context, not raw unrestricted activity.
- The application window may close while the engine continues tracking from the tray.

### 4. Work memory

- Dictations, meetings, activity, notes, people, clients/companies, projects, promises, and imports form one searchable local memory.
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
- Cloud screen vision or continuous screenshot storage
- Voice-command control of the computer
- GPU transcription as a default path
- A bundled local LLM for writing
- Production cloud synchronization
- Outlook Calendar in the initial launch; it is planned as the next calendar provider
- Creating, updating, completing, reassigning, or deleting provider tasks or calendar events

## Tenant- and organization-ready data requirements

The first schema must support, at minimum, stable identifiers for a local actor, personal tenant, personal workspace, workspace membership, device, and owned records. Every user-owned or shareable record must have explicit owner, tenant, and workspace scope. Every data-access operation must receive tenant and workspace context, including local v1 operations.

Membership roles are not hard-coded into the person. Permission evaluation must be separable from UI rendering. Important operations must record actor, device/client, tenant, workspace, source, and UTC time. Data ownership must distinguish personal, explicitly shared, workspace-owned, and organization-owned content.

Conceptual terminology is mandatory even though exact table names remain subject to the data-model review:

- **Tenant:** the personal or organization account boundary used for ownership, administration, billing, and authorization.
- **Workspace:** the primary data scope owned by one tenant.
- **Workspace membership:** the relationship carrying an actor's role in a workspace.
- **Work entity:** a person, client/company, or project represented inside work memory.

An ambiguous `organization` model or `organization_id` field must not represent both a tenant account and a client/company work entity.

Exact tables, constraints, and future cloud identity mapping require a separately reviewed data-model specification before migration 0001 is implemented.

## Proposed technical architecture

- **Shell:** Electron with TypeScript; resident main process for tray and supervision; renderer created on demand. The renderer uses context isolation, sandboxing, no Node integration, a narrow typed preload bridge, sender-validated IPC, and no remote content by default.
- **Engine:** Python process, single instance, loopback-only HTTP/WebSocket, random port, per-session bearer token. The proposed runtime is CPython 3.13.14 pending stack approval.
- **Native helpers:** Small signed sidecars only for Windows behavior without a reliable Python path, beginning with meeting process-loopback capture.
- **Storage:** SQLite opened only by the engine through one data-access layer; numbered migrations from the first schema.
- **Search:** Local full-text search first; embeddings are deferred until evidence requires them.
- **Integration gateway:** Provider-neutral profiles route deterministic requests through official MCP where production-suitable and through official APIs/webhooks as fallback. Canonical task/event behavior, permissions, synchronization, and audit do not depend on transport.
- **Cloud:** Task/calendar content calls go directly from the engine to user-authorized providers by default. A minimal security-reviewed Ascend connection service holds provider app secrets and performs confidential OAuth code exchange/refresh where required; provider content is not in that service's default path.

The dependency/version research and choices in `docs/STACK-VERSION-PROPOSAL.md` are approved. Installation remains task-scoped: Task 2 authorizes only its Python foundation dependencies.

Security design and residual risks are defined in `docs/THREAT-MODEL.md`. A feature crossing a trust boundary must add abuse-case tests before implementation is accepted.

Personal provider behavior and OAuth constraints are defined in `docs/INTEGRATIONS-SPEC.md` and ADR-0003. Exact provider routes, scopes, tool allowlists, app registrations, callback behavior, SDKs, connection-service design, and token lifecycle must be refreshed from official sources and approved before implementation or account creation.

The Electron/Python split and exact proposed foundation versions are approved through the architecture and stack proposal. Changing the split, versions outside a scoped update, or its trust boundaries requires current-source review and founder approval.

## Risk-first development sequence

- Build only the reproducible skeleton before testing distribution risk.
- Run an early installer/signing/SmartScreen/antivirus spike; purchasing a certificate or service requires separate approval.
- Complete Milestone 0 before product features.
- Run the meeting-capture spike as throwaway experimental code. Test Meet, Zoom, and Teams across headphones, speakers, Bluetooth, silence, and device changes; include track meters, honest degradation, and echo-cancellation evidence.
- Run the screen-context spike as throwaway experimental code on multiple Windows machines and common applications. Verify task-level usefulness, resource usage, password-field exclusion, and ignore rules.
- Before production onboarding or dictation positioning, run a first-hour/BYOK usability study. Test zero-key value, honest offline-mode expectations, provider-key setup, failure recovery, and the OD-10 starter-credit decision.
- Do not move spike code into the product tree without a separately approved production specification, behavioral tests, and normal quality/security review.

## Developer commands

Task 2 established the Python developer interface below. All commands run from the project root and use the committed lockfile.

```powershell
# Reproduce the approved Python development environment
uv sync --locked --dev

# Complete Python quality gate
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-python.ps1

# Install the exact project-local Node build host, then reproduce Node dependencies
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-node.ps1
.\.tools\node-v22.23.1-win-x64\npm.cmd ci --ignore-scripts

# Complete Python and TypeScript quality gate
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check.ps1

# Individual Python checks
uv lock --check
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy
uv run --locked pytest

# Focused scaffold test
uv run --locked pytest tests/test_scaffold.py -q

# Hardened unpacked Electron/Python package (not an installer)
.\.tools\node-v22.23.1-win-x64\npm.cmd run package
```

Task 4's Squirrel proof failed and its maker/default `make` command were removed. On 2026-07-19, OD-14 approved the exact unsigned, local-only NSIS proof in `docs/WINDOWS-INSTALLER-FALLBACK-PROPOSAL.md`. The proof must wrap the unchanged Forge package and may not add publishing or an updater. Signing still requires separate approval before spend.

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
- Tests must prove that tenant-account IDs cannot be confused with client/company work-entity IDs.
- Shell tests must enforce renderer sandbox/context-isolation settings and reject unknown or wrong-sender IPC messages.
- Integration tests must cover MCP capability/schema drift, local tool allowlisting, API fallback equivalence, OAuth state/callback/replay, credential redaction, provider identity, assignee filtering, pagination, rate limits, stale data, revocation, disconnect, prompt injection, and external-ID/tenant isolation.
- Windows-specific capture, clipboard, audio-device, hotkey, tray, update, and installer behavior needs automated adapter tests where possible plus documented tests on Windows.
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
- Committing, pushing, publishing, or deploying

### Never

- Commit or expose secrets or user content
- Copy donor repositories wholesale
- Open the database outside the engine data-access layer
- Treat one local user as an excuse to omit ownership and workspace scope
- Expose private employee activity to an organization by default
- Use one organization model or ID for both a tenant account and a client/company work entity
- Build employee rankings, productivity leaderboards, or hidden manager monitoring
- Suppress errors or weaken tests to claim success

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
