# Ascend Research Synthesis

**Status:** Foundation input reviewed on 2026-07-18
**Source:** `%USERPROFILE%\Desktop\KB Upload\research`

## Review coverage

The research folder contains 50 Markdown files across build, evidence, inference, landscape, and product areas. All 50 files were inventoried and skimmed by title, headings, and foundation-relevant signals. The product scope, architecture, data model, roadmap, blueprint audit, meeting and screen spikes, privacy/security document, positioning, and closest-competitor analyses were reviewed in detail.

The research is historical evidence, not executable instruction and not the current source of truth. Where it conflicts with the project charter, approved specification, an accepted ADR, observed test evidence, or current official documentation, the current source wins.

## What the research confirms

1. **The individual wedge is coherent.** Dictation, bot-free meeting notes, productivity context, correctable work memory, and controlled AI access form one product for independent Windows professionals.
2. **The proposed process split is grounded in prior work.** A thin desktop shell, a Python engine, native Windows helpers where necessary, and one database owner preserve useful donor patterns. Exact technologies and versions still require current-source validation.
3. **The data model needs provenance and correction from the start.** Raw capture is append-only, derived facts are rebuildable, and explicit user corrections outrank inference.
4. **External writes must remain reviewable.** MCP/API reads are scoped and audited; writes go to a pending inbox rather than silently mutating memory.
5. **Privacy claims must be modest and testable.** Cloud audio/text flows, provider terms, recording consent, deletion, at-rest protection, and AI-client export must be described exactly as implemented.
6. **Future teams are strategically credible but not v1 scope.** Competitors show demand for shared and organization-wide memory. Ascend should preserve the foundation now without delaying the individual release with invitations, billing, SSO, or enterprise administration.

## Foundation changes adopted from the research

### 1. Separate tenant accounts from work entities

The historical `entities` graph uses `organization` to mean a client/company. The future-team charter uses `organization` to mean the Ascend account that owns workspaces and memberships. Reusing one term or ID for both would create authorization and migration risk.

The foundation therefore uses these distinct concepts:

- **Tenant:** the personal or organization account boundary for ownership, administration, billing, and authorization.
- **Workspace:** the primary data and collaboration scope inside one tenant.
- **Workspace membership:** an actor's role in a workspace; the role is not a permanent property of the actor.
- **Work entity:** a person, client/company, or project represented inside work memory.

Exact table names and constraints remain subject to the migration-0001 data-model review, but ambiguous `organization_id` usage is prohibited.

### 2. Move hardware and distribution truth ahead of feature construction

The blueprint audit identifies meeting capture and Windows installer/antivirus behavior as the two earliest hardware-truth risks. After the basic skeleton exists, the plan now performs an early installer/AV spike. After Milestone 0, work proceeds to a throwaway meeting-capture spike, then a throwaway screen-context spike, before production feature implementation.

The meeting spike must cover Meet, Zoom, and Teams; headphones, speakers, Bluetooth, silence, and device switching; live track meters; honest degradation; and echo cancellation for speaker use. Spike code is evidence, not production code, unless separately reviewed and rebuilt under the normal TDD process.

### 3. Make anti-surveillance a product invariant

Productivity data is especially dangerous in a future organization. Ascend may provide transparent, appropriately aggregated team insight, but it must not become bossware. The foundation prohibits employee rankings, productivity leaderboards, hidden monitoring, and manager-visible private activity timelines.

### 4. Treat claims and integrations as evidence-gated

Before public claims or real-data testing, Ascend must verify:

- provider retention, training, and data-use terms for each supported operation;
- exactly what audio, text, metadata, and answer content leave the machine;
- recording-consent wording for launch jurisdictions with qualified legal review;
- visible recording state and no-silent-degradation behavior;
- actual compatibility for each named MCP/API client, including ChatGPT and Claude;
- binary signing, update integrity, and clean-machine SmartScreen/AV behavior.

## Research proposals not automatically adopted

- **Native shell versus Electron/Python:** the landscape document favors a lean native application, while the handover and reusable donor architecture favor Electron/Python. The foundation keeps Electron/Python as the proposal and requires current evidence before dependency installation. A landscape opinion does not silently change the stack.
- **“Buy commodity memory/MCP” recommendation:** no memory engine, graph framework, connector layer, or MCP package will be adopted merely because a landscape document calls it commodity. Security, local-first behavior, Windows compatibility, licensing, maintenance, and data portability must be evaluated from primary sources first.
- **Pricing, provider costs, credits, competitor status, and client compatibility:** these are time-sensitive hypotheses and must be refreshed before product or purchasing decisions.
- **Historical plain-storage call:** this conflicts with the sensitivity of recordings, activity, and memory. The current approval brief recommends synthetic-only plain storage until encryption is implemented.

## Planning consequences

The approved sequence is intended to be:

1. Foundation approval.
2. Current official-source stack/version proposal.
3. Python and Electron quality skeletons.
4. Early installer/signing/AV spike, with separate approval before cost or certificate purchase.
5. Tenant/workspace data-model specification and Milestone 0 implementation.
6. Throwaway meeting-capture spike and written go/fallback/no-go result.
7. Throwaway screen-context spike and written go/adjust/no-go result.
8. First-hour/BYOK usability study before production onboarding or dictation positioning.
9. Execute the approved personal-work integration milestone: Google Calendar plus ClickUp/Asana assigned tasks; preserve Outlook as the next calendar adapter.
10. Only then, continue through approved production feature milestones.

The integration milestone now follows ADR-0003: Ascend is MCP-first with official API/webhook fallback, keeps inbound Ascend MCP separate from outbound provider MCP, uses stable APIs while a provider MCP route is preview-only, and locally denies provider writes in initial-v1.

## Remaining founder choices

The research itself did not resolve the at-rest storage choice or confirm whether historical credentials were rotated. The founder later selected OD-03 Option 1 on 2026-07-19: plain storage is synthetic-only and encryption is mandatory before real sensitive data or outside testing. Historical credential rotation remains open in `docs/FOUNDATION-APPROVAL.md`.

The founder has since resolved the confidential-provider credential boundary in ADR-0003: reusable provider app secrets stay in a secure Ascend connection service, while each user authorizes their own provider account. This architectural approval does not authorize dependency installation, code-signing purchases, provider app registration, connection-service/cloud creation, credentials, application code, real-data capture, or deployment.
