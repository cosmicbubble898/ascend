# Ascend Task Checklist

Only one task may be in progress at a time. The architecture and stack proposal are approved. Tasks 2 and 3 are complete. Task 4 produced a Squirrel installer `no-go`; its exact unsigned local NSIS proof was approved on 2026-07-19 and is in progress. OD-03 selected synthetic-only plain storage. Retained signing, encryption-before-real-data, credential, provider, and production gates apply at their named blocking points.

## Task 0: Human approval gate

**Description:** Review and approve the charter, foundation spec, ADRs, security baseline, open decisions, and Milestone 0 plan while retaining explicit data/live-service gates.

**Acceptance criteria:**

- [x] Founder approves the foundation architecture in `docs/SPEC.md`.
- [x] Founder approves the organization-ready principle in ADR-0001.
- [x] Founder approves tenant-account versus work-entity separation (OD-02A).
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

**Status:** In progress — OD-14 approved the exact unsigned local NSIS proof on 2026-07-19 after the Squirrel launcher and uninstall failed; no signing spend or outside distribution.

**Description:** Package the approved minimal skeleton and test the Windows install/start/exit/uninstall path early. Research current signing options and eligibility from official sources. Do not buy a certificate or service without separate founder approval.

**Acceptance criteria:**

- [ ] The minimal package installs, starts, exits, and uninstalls in clean Windows test environments.
- [x] Current signing options, cost, eligibility, renewal, and required binary coverage are documented.
- [ ] If signing is approved and available, every executable and helper is signed and SmartScreen/AV observations are recorded.
- [x] Signing is deferred; the unresolved risk and prohibition on outside-test distribution are recorded explicitly.

**Verification:** Installer logs, signature inspection where applicable, clean-machine smoke results, AV/SmartScreen observations, and a written go/fallback/no-go decision.

**Dependencies:** Task 3; separate approval before signing spend
**Likely files:** packaging configuration, `docs/reviews/INSTALLER-SPIKE.md`, signing decision ADR if needed
**Estimated scope:** Medium

## Task 5: Specify migration 0001

**Description:** Define exact local actor, personal tenant, personal workspace, workspace membership, device, migration metadata, IDs, timestamps, constraints, and ownership semantics before SQL or ORM code.

**Acceptance criteria:**

- [ ] Tables and constraints satisfy ADR-0001 and the charter.
- [ ] Personal, shared, workspace-owned, and organization-owned meanings are explicit.
- [ ] Tenant accounts and people/client/company/project work entities have distinct names, types, IDs, and authorization meaning.
- [ ] Upgrade, deletion, and future cloud-identity mapping behavior are documented.

**Verification:** Human review and approval of the data-model spec.

**Dependencies:** Task 4 result, OD-02A, approved OD-03 Option 1, and human approval of the exact data-model specification
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
- [ ] The personal tenant owns the personal workspace without using a client/company work entity.

**Verification:** Focused bootstrap tests plus the full Python checks.

**Dependencies:** Task 6
**Likely files:** bootstrap service, DAL models, focused tests
**Estimated scope:** Medium

## Task 8: Enforce tenant/workspace-scoped data access

**Description:** Use TDD to require explicit tenant and workspace context for repository operations and reject cross-tenant/workspace access.

**Acceptance criteria:**

- [ ] Reads and writes require an actor/client, tenant, and workspace context.
- [ ] Cross-tenant/workspace reads and modifications fail in automated tests.
- [ ] A client/company work-entity ID cannot be accepted as a tenant ID.
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
