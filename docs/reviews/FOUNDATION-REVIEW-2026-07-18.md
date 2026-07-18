# Foundation Quality and Security Review — 2026-07-18

## Scope

Reviewed the project charter, README, engineering instructions, junior workflow, draft specification, organization-readiness ADR, source boundaries, open decisions, `.gitignore`, and Milestone 0 plan/checklist. Also inventoried all 50 Markdown files in `%USERPROFILE%\Desktop\KB Upload\research` and closely reviewed the foundation-critical product, architecture, data, risk, privacy, roadmap, and landscape documents.

No application code, dependencies, lockfiles, database, Git repository, cloud resource, or production configuration exists yet.

## Review verdict

**Ready for founder review after the required documentation fixes below. Not approved for implementation until the founder accepts or edits `docs/FOUNDATION-APPROVAL.md`.**

## Required findings and disposition

### 1. Missing threat model — resolved

The foundation described recordings, credentials, MCP, LLMs, imports, databases, and future organizations without one explicit security model. Added `docs/THREAT-MODEL.md` with assets, trust boundaries, STRIDE risks, abuse cases, required controls, residual risks, and stage gates.

### 2. Combined scaffold task was too large — resolved

The former Task 2 combined Python, Electron, both test stacks, lockfiles, and the full quality gate. Split it into a Python scaffold task and an Electron/top-level quality-gate task. Renumbered dependent tasks.

### 3. LLM and imported content trust was implicit — resolved

Added explicit requirements that imports, provider responses, retrieved content, and LLM output are untrusted. They cannot directly become SQL, shell commands, paths, HTML, permissions, or actions. Added prompt-injection, output-validation, and resource-limit requirements.

### 4. Workspace isolation needed concrete evidence — resolved

The charter already required workspace scope. The review strengthened this into mandatory cross-tenant/workspace denial tests for reads, writes, search, export, caches, files, and future retrieval indexes.

### 5. At-rest storage conflict was unsafe to leave as an assumption — approval required

Historical documents disagree between plain storage and encryption. The spec now permits plain storage only for synthetic development data until OD-03 is approved. The threat model explains the risk and the approval brief presents explicit choices.

### 6. Historical credential exposure remains unverified — external blocker retained

No secret values were opened or copied. Provider testing remains blocked until the founder confirms rotation or revocation of previously exposed credentials.

### 7. “Organization” had two incompatible meanings — resolved

The historical data model uses organization for a client/company entity, while the future-team charter uses organization for the Ascend account that owns workspaces. The charter, spec, ADR, threat model, and tasks now distinguish a tenant account from a work entity and require ID-confusion tests.

### 8. Hardware and distribution risks were sequenced too late — resolved in plan

The research identifies bot-free meeting capture and Windows installer/AV behavior as early hardware-truth risks. The plan now runs the installer/signing/AV spike after the skeleton, then completes Milestone 0, then runs throwaway meeting-capture and screen-context spikes before production features.

### 9. Future productivity analytics could drift into bossware — resolved

The foundation now explicitly prohibits employee rankings, productivity leaderboards, hidden monitoring, and manager-visible private activity timelines. Appropriate aggregate insights remain possible only under transparent policy and permission rules.

### 10. Research recommendations could be mistaken for approved dependencies — resolved

The synthesis records the native-versus-Electron and “commodity memory/MCP” recommendations as hypotheses. Neither can change architecture or introduce a dependency without current primary-source evaluation, an ADR where appropriate, and founder approval.

### 11. Renderer and telemetry controls were implicit — resolved

The foundation now requires Electron sandboxing, context isolation, no Node integration, a narrow typed preload bridge, sender-validated IPC, and no remote content by default. Remote telemetry is off by default and cannot be added without an approved opt-in, content-free specification and tests.

### 12. Assigned-task and calendar access was missing from v1 — resolved in specification

The founder identified current assigned tasks and upcoming meetings as core personal context. V1 now requires read-only Google Calendar plus ClickUp and Asana assigned-task connections. Outlook is preserved as the next calendar provider through the same adapter contract.

### 13. Desktop OAuth secret handling was unsafe to assume — approval required

Official Google documentation supports an installed-app flow, while the current ClickUp and Asana public-app token exchanges require an application client secret. Embedding that secret in a desktop installer is prohibited. OD-12 recommends a separately specified minimal token-only broker for public one-click connection; no broker or cloud resource is authorized by the foundation.

## Five-axis review

- **Correctness:** Product scope, tenant/organization direction, terminology, implementation gate, risk-spike order, and task dependencies are consistent after renumbering.
- **Readability:** Each document has one job; README provides the reading order; current documents override historical material.
- **Architecture:** Individual v1 avoids full enterprise scope while preserving actor/tenant/workspace/membership/permission seams and a separate work-entity graph.
- **Security:** Threat boundaries, privacy defaults, untrusted AI/import handling, isolation tests, secret rules, and stage gates are explicit. OD-03 and credential rotation remain intentionally unresolved.
- **Performance/scale:** Pagination, bounded work, incremental jobs, explicit workspace scope, and avoidance of unbounded in-memory assumptions are requirements from the foundation.

## Verification performed

- Enumerated every project file and document status.
- Checked task sizes, dependencies, acceptance criteria, risk-spike gates, and verification steps.
- Cross-checked current documents against the 50-file research inventory and recorded adopted, rejected, and still-unverified recommendations in `docs/RESEARCH-SYNTHESIS.md`.
- Verified current official Google Calendar, Microsoft Graph/identity, ClickUp, and Asana documentation for read capability, OAuth, consent, pagination, and rate-limit constraints; recorded dated source URLs in `docs/INTEGRATIONS-SPEC.md`.
- Checked source-of-truth and approval-gate wording across the documentation set.
- Checked for forbidden secret-bearing files and common credential-value patterns.
- Checked referenced local project documents exist.
- Confirmed the workspace is still documentation-only and not initialized as Git.

No build or automated application tests were run because no application exists. Documentation validation is the appropriate evidence at this stage.

## Remaining founder decisions

The foundation can be approved now, but implementation remains gated by the selections in `docs/FOUNDATION-APPROVAL.md`. Credential rotation may remain “not yet”; that blocks provider testing rather than documentation approval.

## Addendum — integration architecture approved later on 2026-07-18

The original review accurately recorded the provider evidence available at that point, but its OD-12/minimal-broker conclusion is now historical. After reviewing current official remote MCP behavior, the founder approved ADR-0003 and the revised integration specification:

- Ascend acts as an outbound MCP client for provider connections and separately exposes its own inbound MCP/API surface.
- Provider routing is MCP-first with official API/webhook fallback, not MCP-only.
- Google Calendar and Outlook use stable APIs while their official MCP routes remain preview-stage.
- Reusable provider app secrets belong only in a secure Ascend connection service; every user completes provider consent for their own account.
- Initial-v1 remains read-only, with a local deny-by-default tool/scope allowlist even when a provider advertises writes.

This resolves OD-12 at the architecture level. OD-13 retains the separate approval gate for provider apps, callback domains, service hosting, secrets, costs, live credentials, and deployment. OD-03 and OD-04 remain unresolved.
