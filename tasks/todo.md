# Ascend Task Checklist

Only one task may be in progress at a time. The architecture, stack proposal, OD-17 Windows hardware behavior, and OD-20 future local screenshot-context direction are approved; OD-18 future-capability and OD-19 Agent OS architectures are proposed. Tasks 2–4A are complete locally. Task 4's exact OD-16 custom-cleanup NSIS route is `go-local`; clean-machine and release qualification remain open. Task 5 specification work may begin, but migration implementation still requires approval of the exact data-model specification, and OD-21 blocks Task 7. OD-03 selected synthetic-only plain storage. Retained signing, encryption-before-real-data, screenshot/vision, credential, provider, runtime/model, agent/skill, and production gates apply at their named blocking points.

## Task 0: Human approval gate

**Description:** Review and approve the charter, foundation spec, ADRs, security baseline, open decisions, and Milestone 0 plan while retaining explicit data/live-service gates.

**Acceptance criteria:**

- [x] Founder approves the foundation architecture in `docs/SPEC.md`.
- [x] Founder approves the organization-ready principle in ADR-0001.
- [x] Founder approves tenant-account versus memory-entity/context separation (OD-02A).
- [x] Founder approves ADR-0002 product scope and `docs/INTEGRATIONS-SPEC.md` provider scope/sequence.
- [x] Founder approves ADR-0003: MCP-first/API-fallback transport, secure connection-service credential boundary, per-user grants, and read-only initial-v1.
- [x] OD-03 Option 1 is recorded: plain storage for synthetic development data only; encryption before real data or outside testing.
- [ ] Credential rotation status is known before provider testing.

**Verification:** Written approval in the task conversation and corresponding document updates.

**Dependencies:** None
**Likely files:** `docs/SPEC.md`, `docs/OPEN-DECISIONS.md`, `tasks/plan.md`
**Estimated scope:** Small

## Task 1: Verify and record the development stack

**Status:** Complete — proposal approved by founder on 2026-07-18.

**Description:** Check current official Electron, Node.js, TypeScript, Python, FastAPI, SQLite/encryption, pytest, Vitest, Ruff, mypy, and packaging guidance; propose pinned versions without installing them until approved.

**Acceptance criteria:**

- [x] Every proposed dependency has an official source and compatibility rationale.
- [x] Windows and selected-runtime compatibility is confirmed at the official-metadata level, with real install/package proof explicitly assigned to Tasks 2–4.
- [x] Runtime, framework, test/quality, SQLite/encryption, and packaging choices are recorded in `docs/STACK-VERSION-PROPOSAL.md`.
- [x] Founder approves the proposal; the approved versions are reflected as accepted in the spec and Task 2 is authorized.

**Verification:** Official-source review plus document/link consistency checks; no installation yet.

**Dependencies:** Task 0
**Likely files:** `docs/STACK-VERSION-PROPOSAL.md`, `docs/SPEC.md`, new dependency decision ADR if needed
**Estimated scope:** Small

## Task 2: Create the Python engine skeleton

**Status:** Complete — verified on 2026-07-18; no product behavior or database added.

**Description:** After version approval, create the minimal Python package, locked dependency inputs, one placeholder behavioral test, and Python-only quality commands without product behavior.

**Acceptance criteria:**

- [x] Approved Python dependencies install reproducibly from `uv.lock` under CPython 3.13.14.
- [x] One placeholder pytest test runs.
- [x] Ruff formatting/lint and mypy run with enforced exit codes through `scripts/check-python.ps1`.

**Verification:** Run the approved Python install, pytest, Ruff, and mypy commands recorded in `docs/SPEC.md`.

**Dependencies:** Founder approval of the Task 1 proposal
**Likely files:** `pyproject.toml`, dependency lock/input files, `engine/__init__.py`, `tests/test_scaffold.py`, Python check script
**Estimated scope:** Medium

## Task 3: Create the Electron shell skeleton

**Status:** Complete — verified on 2026-07-18; no product behavior added.

**Description:** Create the minimal TypeScript/Electron package, one placeholder Vitest test, and the top-level quality-gate script that invokes both language toolchains.

**Acceptance criteria:**

- [x] Approved Node dependencies install from one authoritative lockfile with unreviewed install scripts blocked.
- [x] Vitest, lint, formatting, type-check, and build commands run.
- [x] `scripts/check.ps1` invokes every Python and TypeScript check and propagates every failure.

**Verification:** `powershell -ExecutionPolicy Bypass -File .\scripts\check.ps1`

**Dependencies:** Task 2
**Likely files:** `package.json`, lockfile, TypeScript/Vitest configuration, shell placeholder/test, `scripts/check.ps1`
**Estimated scope:** Medium

## Task 4: Run the early installer/signing/AV spike

**Status:** Local risk result complete (`go-local`) on 2026-08-05 — the exact OD-16 custom-cleanup NSIS route passed on the current development machine; clean-machine and release qualification remain open; no signing spend or outside distribution.

**Description:** Package the approved minimal skeleton and test the Windows install/start/exit/uninstall path early. Research current signing options and eligibility from official sources. Do not buy a certificate or service without separate founder approval.

**Acceptance criteria:**

- [ ] The minimal package installs, starts, exits, and uninstalls in clean Windows test environments.
- [x] Current signing options, cost, eligibility, renewal, and required binary coverage are documented.
- [ ] If signing is approved and available, every executable and helper is signed and SmartScreen/AV observations are recorded.
- [x] Signing is deferred; the unresolved risk and prohibition on outside-test distribution are recorded explicitly.
- [x] Exact local standard-NSIS proof and supply-chain evidence are recorded, including its executable-residue `no-go`.
- [x] Founder approved OD-16 before the custom uninstall macro was created.
- [x] Exact local custom-cleanup proof passes normal cache removal, unexpected-sentinel preservation, reinstall, profile retention, and Defender checks.

**Verification:** Installer logs, signature inspection where applicable, clean-machine smoke results, AV/SmartScreen observations, and a written go/fallback/no-go decision.

**Dependencies:** Task 3; separate approval before signing spend
**Likely files:** packaging configuration, `docs/reviews/INSTALLER-SPIKE.md`, signing decision ADR if needed
**Estimated scope:** Medium

## Task 4A: Remediate the foundation audit

**Status:** Complete locally — verified on 2026-08-10 under the founder-approved `docs/AUDIT-REMEDIATION-PROPOSAL.md`; release gates remain open

**Description:** Correct the patched runtime baseline, installer fail-closed policy, evidence binding and installed-tree validation, Unicode-path proof, project-local Python toolchain selection, and identified privacy/specification overclaims without broadening local-only synthetic foundation scope.

**Acceptance criteria:**

- [x] Node `22.23.2` and Electron `43.3.0` are exact, source-verified, locked, and proven through the package/runtime checks.
- [x] Complete installer repository policy runs before packaging and rejects duplicate or additional builder overrides.
- [x] Smoke evidence binds the tested artifact hash to one proof run and validates the complete installed tree.
- [x] The Unicode smoke path proves actual U+00DC storage without Windows PowerShell mojibake.
- [x] The documented one-command quality gate selects the exact project-local uv/Python toolchain without temporary environment injection.
- [x] Privacy, encryption, terminology, Task 7, and Task 8 wording reflects testable boundaries.
- [x] Full quality, advisory, signature, package/fuse, manifest, Defender, and bounded installer lifecycle verification passed with residual development-only risk recorded.

**Verification:** Follow the exact TDD and verification order in `docs/AUDIT-REMEDIATION-PROPOSAL.md`; retain a new dated local proof rather than rewriting historical evidence.

**Dependencies:** Approved Task 4 local result and founder approval on 2026-08-10; no release, real-data, provider, model, screenshot, agent, or Task 6 authority
**Likely files:** approved remediation proposal, runtime/toolchain manifests, installer policy/tests, smoke harness, package/lock files, current specifications and review evidence
**Estimated scope:** Medium

## Task 5: Specify migration 0001

**Status:** Drafted and mechanically validated on SQLite 3.53.1 on 2026-08-05; awaiting founder review and approval before Task 6.

**Description:** Define exact local actor, personal tenant, personal workspace, workspace membership, device, migration metadata, IDs, timestamps, constraints, and ownership semantics before SQL or ORM code.

**Acceptance criteria:**

- [ ] Tables and constraints satisfy ADR-0001 and the charter.
- [ ] Personal, shared, workspace-owned, and organization-owned meanings are explicit.
- [ ] Tenant accounts and representative personal/professional memory entities or contexts have distinct names, types, IDs, and authorization meaning; memory content never grants authority.
- [ ] Upgrade, deletion, and future cloud-identity mapping behavior are documented.

**Verification:** Human review and approval of the data-model spec.

**Dependencies:** Satisfied Task 4 local `go` result, OD-02A, approved OD-03 Option 1, and human approval of the exact data-model specification
**Likely files:** new `docs/DATA-MODEL.md`, `docs/SPEC.md`
**Estimated scope:** Small

## Task 6: Implement the numbered migration runner

**Description:** Use TDD to create deterministic, checksum-aware migration application and future-version refusal behavior.

**Acceptance criteria:**

- [ ] A focused test fails before implementation for missing migration behavior.
- [ ] Migration 0001 applies once and records version/checksum/time.
- [ ] Re-running is safe; unknown future schemas and checksum changes fail visibly.

**Verification:** Focused pytest command defined during Task 2, then the full Python checks.

**Dependencies:** Task 5
**Likely files:** migration module, migration SQL, migration tests
**Estimated scope:** Medium

## Task 7: Bootstrap the personal tenant and workspace

**Description:** Use TDD to create one stable local actor, personal tenant, personal workspace, owner membership, and device without requiring a cloud account.

**Acceptance criteria:**

- [ ] First run creates exactly one valid foundation set.
- [ ] Repeated startup reuses stable IDs rather than duplicating rows.
- [ ] Membership carries the owner role; identity does not.
- [ ] The personal tenant owns the personal workspace without using any personal/professional memory entity or context as an account principal.

**Verification:** Focused bootstrap tests plus the full Python checks.

**Dependencies:** Task 6
**Likely files:** bootstrap service, DAL models, focused tests
**Estimated scope:** Medium

## Task 8: Enforce tenant/workspace-scoped data access

**Description:** Use TDD to require explicit tenant and workspace context for repository operations and reject cross-tenant/workspace access.

**Acceptance criteria:**

- [ ] Reads and writes require an acting actor, tenant, and workspace context; optional caller/client provenance is recorded separately and never substitutes for actor identity.
- [ ] Cross-tenant/workspace reads and modifications fail in automated tests.
- [ ] Representative personal/professional memory-entity or context IDs cannot be accepted as tenant IDs.
- [ ] A structural check confirms SQLite is opened only by the DAL.

**Verification:** Focused isolation tests, full Python checks, and source search for direct DB opens.

**Dependencies:** Task 7
**Likely files:** DAL interface, sample repository, authorization policy, tests
**Estimated scope:** Medium

## Task 9: Build the authenticated engine readiness surface

**Description:** Use TDD to create a loopback-only engine with random port, per-session token, readiness response, and clean shutdown hook.

**Acceptance criteria:**

- [ ] The service refuses non-loopback binding.
- [ ] Protected readiness rejects missing or wrong tokens.
- [ ] Shutdown checkpoints and closes the database cleanly.

**Verification:** Focused API tests plus full Python checks.

**Dependencies:** Task 8
**Likely files:** engine entry point, config, API app, tests
**Estimated scope:** Medium

## Task 10: Supervise the engine from the shell

**Description:** Use TDD to start the engine, wait for authenticated readiness, preserve it when the renderer closes, and terminate it safely on tray Quit.

**Acceptance criteria:**

- [ ] The shell never treats an unrelated process on the port as Ascend.
- [ ] Renderer close and application Quit have different, tested lifecycle behavior.
- [ ] Graceful shutdown has a bounded force-kill fallback and leaves no orphan process.

**Verification:** Focused Vitest tests, full shell checks, full quality gate, and a Windows runtime smoke test.

**Dependencies:** Task 9
**Likely files:** supervisor, main process, engine-path helper, tests
**Estimated scope:** Medium

## Task 11: Approve the Windows hardware and permission baseline

**Status:** Approved by the founder on 2026-07-19; implementation remains behind the Milestone 0 task order and named dependency gates

**Description:** Review and approve the exact multiple-monitor, multi-microphone, multi-output, capability-onboarding, output-suppression, restoration, and crash-recovery contract before native behavior is implemented.

**Acceptance criteria:**

- [x] The founder approves `docs/WINDOWS-HARDWARE-BASELINE-PROPOSAL.md` and its all-active-output default.
- [x] Mute-before-capture ordering, read-back verification, observable user-change ownership, post-restore verification, and the Core Audio same-value/final-race limitation are explicit.
- [x] One-to-six plus higher synthetic display counts, mixed DPI, negative coordinates, and topology-change behavior are explicit.
- [x] Windows permission limitations and capability-specific onboarding wording are truthful.
- [x] Native dependency/toolchain, real capture/data, hardware test, signing, and release gates remain explicit.

**Verification:** Human review against Microsoft/Electron sources and donor-gap evidence.

**Dependencies:** None for documentation approval; Task 12 remains dependent on Task 10 and OD-17
**Likely files:** `docs/WINDOWS-HARDWARE-BASELINE-PROPOSAL.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/THREAT-MODEL.md`
**Estimated scope:** Small

## Task 12: Build fake hardware contracts and display topology

**Description:** With TDD, define the typed hardware/capability contracts, pure dictation hardware state machine, fake audio adapter, and Electron main-process display topology service without adding a native dependency or capturing real audio.

**Acceptance criteria:**

- [ ] Tests prove suppression-blocked/limited, explicit override, idempotent stop, mute-state versus volume-only ownership, hot-plug, event-between-every-step races, per-phase lease failure, and cold-start confirmation transitions.
- [ ] One hardware arbiter rejects unsafe overlap between dictation, microphone tests, meeting capture, and future system-audio capture with visible `hardware_busy` behavior.
- [ ] Display tests cover the proposal's deterministic matrix: 1–6 and synthetic 12 displays, negative coordinates, mixed DPI, invalid/unified/headless/remote identities, focused-target fallback, primary/topology changes, missing-display restoration, and virtual/secure-desktop visibility failure.
- [ ] Session and indicator state tests fail closed for renderer/main failure, lock, user switch, RDP disconnect, suspend/resume, logoff, shutdown/restart, and hidden/cloaked indicators as far as fake contracts permit.
- [ ] The renderer receives only narrow view models and allowed commands.
- [ ] No real audio, device content, or new native dependency enters the slice.

**Verification:** Focused Python/TypeScript tests, full quality gate, and security/interface review.

**Dependencies:** Task 10 and approved Task 11/OD-17
**Likely files:** engine hardware contracts/state tests, `shell/main` display service/tests, narrow preload types
**Estimated scope:** Medium

## Task 13: Propose and prove the Windows audio adapter

**Description:** Verify the smallest supported Windows implementation/toolchain for Core Audio enumeration, notifications, endpoint mute/read-back, microphone capture, and controller-death recovery; obtain dependency/toolchain approval before implementation.

**Acceptance criteria:**

- [ ] Current official sources and donor evidence support the selected boundary.
- [ ] A reviewed ADR defines the controller/helper trust boundary, native toolchain, authenticated narrow IPC, per-user lease path/ACL, single-instance ownership, boot/session binding, and Windows end-session/RDP behavior.
- [ ] The adapter returns typed results and never exposes COM/native objects outside its boundary.
- [ ] A Windows proof covers multiple endpoints, hot-plug, already-muted state, partial failure, user changes, crash recovery, and honest exclusive-mode limitations.
- [ ] Physical capture/data and distribution occur only after their named gates.

**Verification:** Separate approved proposal, behavioral adapter tests, documented Windows hardware matrix, full quality gate, and security/code-quality review.

**Dependencies:** Task 12; separate native dependency/toolchain and real-capture approvals
**Likely files:** new ADR under `docs/decisions/`, `native/`, engine adapter boundary, tests, helper IPC/lease threat-model update, hardware proof document
**Estimated scope:** Large

## Task 14: Approve future capability and sensitive-domain architecture

**Status:** Proposed under OD-18; documentation/research complete, founder approval pending

**Description:** Review the public competitor-failure corpus and approve the long-term seams for replaceable cloud/local capabilities, isolated model/native workers, explicit execution provenance and locality, OD-20's future local screenshot/vision path, future meeting-bot capture, speaker identity, and holistic personal domains without implementing them now.

**Acceptance criteria:**

- [x] Official public support/status evidence and clearly labeled public anecdotes are converted into failure classes, controls, and future test obligations without claiming private-ticket access or issue prevalence.
- [x] The proposal keeps product modules independent from Parakeet-family, llama.cpp-family, CUDA, DirectML, Windows ML, and later CPU/GPU/NPU implementations.
- [x] Runtime workers, model artifacts, local/cloud policy, resource governance, screenshot/visual-context classification, capture-source provenance, speaker evidence, and sensitive data classes have explicit security boundaries.
- [x] Screenshot capture/storage, local vision/models, cloud bots, speaker identity, health/wellness modules, external plugins, dependencies, cloud resources, real data, spending, and deployment remain separately gated.
- [ ] Founder approves `docs/FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL.md`, OD-18, and ADR-0004.

**Verification:** Source link review, charter/spec/architecture/threat-model consistency, Markdown/full quality gate, security review, and code-quality review.

**Dependencies:** None for documentation approval; concrete implementation depends on the first relevant approved production-feature specification
**Likely files:** `docs/COMPETITOR-FAILURE-RESEARCH-2026-07-19.md`, `docs/FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL.md`, proposed ADR-0004, charter, architecture, spec, threat model
**Estimated scope:** Medium

## Task 15: Add the first concrete capability contract with a production feature

**Status:** Future; do not start during Milestone 0 or before OD-18 and a feature-specific approval

**Description:** With TDD, add only the minimum versioned request/result, execution-receipt, typed-failure, fake-adapter, and conformance behavior required by the first approved transcription, AI, or capture vertical slice. Do not select or install a model/runtime unless that same feature specification explicitly approves it.

**Acceptance criteria:**

- [ ] One small behavioral test fails first for the missing contract behavior and passes after minimum implementation.
- [ ] Domain code has no direct dependency on a concrete model/provider/native backend.
- [ ] Fake local/cloud adapters prove explicit locality, no silent fallback, provenance, cancellation, timeout, partial failure, and resource-denial behavior.
- [ ] Worker interfaces grant no direct database, credential-store, MCP, or unrelated workspace authority.
- [ ] Applicable competitor-failure rows become named regression/fault-injection tests.
- [ ] No speculative screenshot store/vision index, bot, speaker-profile, health/wellness, or external-plugin infrastructure is added.

**Verification:** Focused behavioral tests, conformance/fault tests, full quality gate, security/interface/code-quality review, and an approved feature specification.

**Dependencies:** Approved Task 14/OD-18 plus the first relevant production-feature specification and its own dependency/runtime/data approvals
**Likely files:** engine capability contracts and tests selected by that future feature specification
**Estimated scope:** Medium

## Task 16: Approve the Agent OS and skills architecture

**Status:** Proposed under OD-19; documentation and current-source research complete, founder approval pending

**Description:** Approve the long-term boundary for Ascend to become the trusted personal agent and single interface across replaceable models, external agents, skills, typed tools, connectors, context, policy, approvals, and durable runs without implementing those systems now.

**Acceptance criteria:**

- [x] Official ClickUp, OpenAI, Anthropic, and MCP sources inform the skill, tool, connector, orchestration, approval, and authorization distinctions.
- [x] Skills, tools, connectors, models, external agents, agent profiles, workflows, triggers, runs, grants, approvals, and receipts have separate definitions.
- [x] Skills never grant authority, models never execute directly, and context disclosure is separate from inference.
- [x] Typed side effects require deterministic policy, exact approval binding, idempotency, uncertain-outcome reconciliation, verification, and audit.
- [x] Personal/workspace/organization ownership, private defaults, and distinct share/install/activate/invoke behavior are explicit.
- [x] Provider model use, inbound Ascend MCP/API clients, and outbound documented external-agent APIs are separate; browser/session/private-endpoint control is excluded from the foundation.
- [x] Milestone 0 gains no speculative schema, runtime, dependency, credential, provider account, cloud resource, external write, or autonomous behavior.
- [ ] Founder approves `docs/AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL.md`, OD-19, and ADR-0005.

**Verification:** Official-source link review, charter/spec/architecture/threat-model consistency, Markdown/full quality gate, security review, and code-quality review.

**Dependencies:** None for documentation approval; concrete implementation depends on Milestone 0, OD-18 where capability/runtime seams apply, OD-19, and a separately approved agentic feature specification
**Likely files:** `docs/AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL.md`, proposed ADR-0005, charter, architecture, spec, threat model, open decisions, plan
**Estimated scope:** Medium

## Task 17: Specify the first read-only agentic vertical slice

**Status:** Future; do not start during Milestone 0 or before OD-19 and all applicable feature/integration/provider approvals

**Description:** Consider a manually started Daily Work Brief as the first bounded agentic slice. It may combine permitted local work memory, upcoming Google Calendar events, and assigned ClickUp/Asana tasks through one reviewed built-in instruction-only skill and one approved model route, producing a source-linked draft without changing any external or trusted record.

**Acceptance criteria:**

- [ ] A written feature specification defines exact inputs, context disclosures, provider route, retention, typed read tools, run states, budgets, cancellation, receipts, deletion, evaluation, and failure behavior.
- [ ] One small behavioral test fails first for the missing run/authority behavior and passes after the minimum implementation.
- [ ] Cross-tenant/workspace/data-class and prompt-injection tests prove that skill text, provider content, and model output cannot broaden context or tool authority.
- [ ] Only read operations are reachable; no task, calendar, message, file, provider, or memory write exists in the slice.
- [ ] The run ledger records source references, selected skill/model/provider versions, disclosure route, cost/latency, and terminal state without duplicating private content into diagnostics.
- [ ] No background trigger, multi-agent orchestration, script-capable/third-party skill, browser automation, or external-agent control is introduced.

**Verification:** Approved spec, TDD evidence, focused authority/run/context tests, full quality gate, security/interface/code-quality review, and manual source-link/result review.

**Dependencies:** Completed Milestone 0; approved OD-18 if its capability seam is used; approved OD-19; applicable Google/ClickUp/Asana integration gates; approved model/provider, retention, credential, and data-storage decisions
**Likely files:** Exact files chosen by the future approved feature specification; no speculative location is authorized now
**Estimated scope:** Large

## Task 18: Specify and prove the future local screenshot-context slice

**Status:** Future; do not start during Milestone 0 or initial v1, or before the baseline screen-context spike, OD-18 approval, proven encrypted storage, and a separately approved visual-context specification

**Description:** Evaluate the OD-20 direction as its own high-risk vertical slice: user-approved Windows screenshots retained encrypted on the person's machine and analyzed only by an approved local vision/OCR worker. This task does not assume a three-second cadence, a capture API, a model, a runtime, or permanent retention.

**Acceptance criteria:**

- [ ] A written feature specification keeps accessibility metadata, transient OCR frames, retained screenshots, and derived visual observations as separate modes, data classes, and permissions.
- [ ] Current official-source research selects the exact Windows capture route, package requirements, local model/runtime, license, artifact/download policy, and supported hardware only after explicit approval.
- [ ] Capture is off by default, visibly active, pauseable, target/region scoped, exclusion-aware, and fail-closed across lock, user-switch, secure-desktop, indicator failure, wrong-display, and unsupported-capture states.
- [ ] Proven encryption covers screenshots, thumbnails, temporary files, indexes, crash recovery, and backups before any real screenshot is persisted; retention, quotas, review, export, deletion cascade, and uninstall behavior are explicit.
- [ ] The local vision/OCR worker receives brokered read-only asset handles and has no network, SQLite, credential-store, MCP, provider-grant, or unrelated filesystem/workspace authority.
- [ ] Raw pixels cannot reach cloud fallback, telemetry, logs, support bundles, general API/MCP/export, organization access, or unrelated AI context by default.
- [ ] Synthetic tests include revealed passwords, password managers, OTPs, terminal secrets, notifications, private apps, wrong displays, exclusion races, duplicates, disk-full, OOM, thermal/battery pressure, model failure, cancellation, and deletion.
- [ ] Cadence/event policy, duplicate suppression, usefulness, model accuracy, latency, CPU/RAM/GPU/NPU use, storage growth, battery impact, and honest unsupported coverage receive a written go/adjust/no-go result before any production promotion.
- [ ] Product wording states that local-only encrypted storage reduces disclosure but cannot guarantee no screenshot contains a secret or protect an already unlocked Windows account from same-user malware.

**Verification:** Approved feature and security specification, synthetic-first TDD/fault-injection evidence, dated Windows/hardware/model support matrix, local network-denial proof, encryption/retention/deletion proof, full quality gate, and security/code-quality review.

**Dependencies:** Completed Milestone 0; baseline screen-context spike result; approved OD-18/ADR-0004; resolved OD-20 direction; implemented and proven at-rest encryption; exact capture/model/runtime/dependency approval; separate authorization before real data or outside testing
**Likely files:** Exact files selected by the future approved specification; migration 0001 must not pre-build screenshot tables
**Estimated scope:** Large
