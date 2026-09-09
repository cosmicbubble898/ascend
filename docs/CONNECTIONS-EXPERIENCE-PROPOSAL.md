# Ascend connections experience

**Date:** 2026-09-05
**Status:** Withdrawn on 2026-09-05 after founder correction. Historical proposal only; do not implement its API-first routes, duplicated provider adapters, or CX task sequence.

**Current direction:** Reuse official MCP servers through one shared connection system, keep sign-in simple, and minimize provider-specific code. API adapters require demonstrated need for a specific capability. The intended product includes supported reads and actions; action implementation still needs its exact permission/confirmation contract. Approved ADR-0003 remains in force. The text below records the abandoned proposal, not current requirements.

## Product experience

Ordinary setup is: Connections -> choose app -> Connect -> provider sign-in/consent -> choose sources -> Connected. Users do not choose a protocol, register developer apps, or paste callback URLs in this path. Provider-required consent, admin approval, and reauthentication remain visible when necessary.

API and MCP are interchangeable implementation options where their actual capabilities permit it. MCP standardizes tool access; it is not a shared login or universal permission network. Connecting Google or Microsoft does not authorize unrelated ClickUp or Asana accounts. Installing a plugin makes capabilities available; it does not grant account access.

Use one searchable app catalog showing capabilities: Get tasks, Get meetings, Share context with an AI assistant, or Use a model inside Ascend. One app can expose multiple separately authorized capabilities. Connected accounts show identity, selected sources, permitted uses, last update, health, reconnect, pause, AI-access management, and disconnect. Multiple accounts remain separate; reconnect never silently replaces one account with another.

Initial scope stays personal read-only ClickUp/Asana tasks and Google Calendar events. Microsoft/Outlook is next and labeled Planned until verified. Unsupported features have no active Connect button.

## Supported methods

| Option | User experience | Availability |
| --- | --- | --- |
| Recommended | Connect and sign in; Ascend chooses a reviewed route | Default for each supported capability |
| Official API | Optional advanced choice with supported authorization | Only after permission, field, and synchronization contract tests |
| Official MCP | Optional advanced choice, or recommended for a proven capability | Only after tool/schema, quota, authorization, and compatibility checks |
| Custom MCP | Future advanced connection to a user-selected server | Separate security specification; unavailable in initial release |

Build one proven route per provider first. Keep adapter interfaces for later alternatives without building both upfront. Proposed initial sync routes are ClickUp REST, scoped Asana REST, Google Calendar API, and later Microsoft Graph. Evaluate official MCP for interactive capabilities and later alternatives. This changes ADR-0003's preference only after acceptance and document reconciliation.

Do not imply all services support API keys. Model APIs with user-owned keys are a distinct advanced flow, with their own billing and credentials. A ChatGPT or Claude subscription connection does not supply those API credentials.

Fallback requires a separately valid route grant, matching provider account and selected sources, and verified equivalent fields/permissions. Do not reuse MCP tokens for REST calls. Do not bypass revocation or a provider restriction by switching routes. If new consent is needed, show Reconnect; partial results cannot be declared a complete snapshot.

Custom MCP must later specify endpoint trust, OAuth discovery, redirect/DNS/SSRF protection, explicit local-network policy, credential binding, tool validation, and resource limits. A server URL cannot authorize executable installation, arbitrary tools, or expanded data access.

## Information sharing

Keep three relationships independent:

1. Provider -> Ascend: authorized imports into personal memory.
2. Ascend -> approved AI client: scoped disclosure through Ascend tools.
3. Ascend -> model API: inference inside Ascend with separate provider credentials.

Example: connect Asana, select a workspace, then allow Claude to read task titles and deadlines from that connection alongside separately permitted meeting summaries. Neither grant hands Claude the Asana token or permits editing Asana.

Offer persistent, revocable read presets to avoid repeated prompts: 'Allow this assistant to read tasks and meeting summaries from these sources until I disconnect it.' Show recipient, sources, fields/data classes, and duration before activation. Also offer 'Only this request'. A broader recipient, source, data class, or operation requires new consent. Never preselect broad sharing or expand grants because new tools become available.

Import consent is not AI-disclosure consent. Local connector execution does not imply local inference: explain when returned information goes to a cloud AI. Do not promise that local deletion recalls copies already delivered elsewhere.

External clients get individual grants, never the internal shell session token or provider credentials. The engine applies permissions before retrieval and again before results leave Ascend, returning bounded source-linked results with freshness. Direct record IDs and hostile prompts cannot bypass checks. This minimal disclosure policy belongs in initial AI access; the full Agent OS is not a prerequisite.

## Local and remote clients

| Route | Required delivery contract |
| --- | --- |
| Supported local desktop client | Reviewed installable adapter, guided pairing, separate revocation; engine remains database owner |
| ChatGPT developer-mode MCP | Verify HTTPS/tunnel availability, account/workspace permissions, authentication, and runtime health; developer setup is not a consumer onboarding promise |
| Published remote AI connector | Separate hosted endpoint/relay design with authentication, device binding, bounded operations, availability, data-flow disclosure, and operating budget |
| Claude remote connector | Separate from its local desktop extension; prove cloud reachability and remote authentication |

Prove one local desktop client with synthetic data first. Remote ChatGPT delivery is a separate compatibility milestone that must resolve consumer setup before advertising easy connection. Never publish the engine's general API. Any future relay may expose only reviewed MCP operations, never arbitrary local URLs or commands. Access while the laptop is off requires a separate availability/storage decision.

## Sync and disconnect

Synchronize while Ascend runs using incremental reads where supported, within quotas. Refresh after wake/network recovery and offer Refresh now. Display stale, partial, rate-limited, disconnected, and unavailable states honestly. No promise of fresh data while the laptop is asleep.

Use polling/incremental reads for the first slice. A future webhook receiver is separate from the OAuth connection service and needs its own hosting, authenticity, replay, renewal, queue, and retention contract. Notifications trigger reconciliation rather than unvalidated changes to local truth.

Specify route-specific cursors and bounded full-resync recovery. Invalid cursors rebuild only the affected provider snapshot. Commit completed refresh state after validated pagination; use a connection generation check to reject late results after disconnect. Access revocation blocks disclosure of affected records; temporary outages show stale data under the existing grant.

Pause sync preserves credentials and visibly stale data. Revoke AI access blocks new disclosure without disconnecting the provider. Disconnect stops jobs, blocks in-flight persistence/disclosure, removes local credentials, attempts upstream revocation, and disables AI disclosure of that connection by default. Retained history is visibly disconnected; renewed disclosure requires an explicit choice.

Offer separate deliberate deletion of imports and local derivatives. Track provenance for summaries, indexes, caches, and mixed-source records: remove affected derivatives or rebuild them using still-authorized sources. Preserve independently authored notes under their own policy. Later backup/restore must not resurrect revoked grants or deleted content. External copies already disclosed are outside this local deletion guarantee.

## Small implementation tasks

Existing foundation, exact data-model, encryption, and OD-13 live-service gates still apply. Each production task begins with one failing behavioral test, minimal implementation, and focused/relevant checks. This proposal selects no new dependency.

| Task | Acceptance | Dependencies and verification |
| --- | --- | --- |
| CX-1 | Synthetic connection lifecycle isolates two accounts; mismatch, cancellation, reconnect, unsupported routes are explicit; no network | Exact design approval; new engine connection module and Python tests; pytest, Ruff, mypy |
| CX-2 | Connections UI with synthetic state; default flow requires no protocol/key/developer configuration | CX-1 and approved typed IPC contract; shell UI/bridge tests, typecheck/build, automated UI assertions and usability walkthrough |
| CX-3 | One fake provider sync handles pagination, identity, quotas, wake recovery, and failed refresh without duplicate/lost records | Approved persistence contract; synthetic adapter tests and focused quality checks |
| CX-4 | Minimal AI grants and one synthetic local MCP client; search/fetch respect selected sources/fields | Approved grant/transport contract; wrong-client, direct-ID, injection, expiry, and revoke-during-fetch tests |
| CX-5 | First actual provider sign-in with exact account/source selection and reviewed permissions | OD-13, encryption, registration/credentials/live-test approval; dedicated-account integration evidence |
| CX-6 | Remaining initial providers, then separately verified remote AI access | Previous slice passes; provider-specific consent tests and remote delivery/cost approval |

Release evidence must cover cancelled/admin-denied consent, unavailable alternatives, incompatible tokens, account mismatch, partial pagination, invalid cursor, laptop sleep, exhausted quotas, token refresh failure, and disconnect during retrieval. Imported records alone must not grant AI access; saved read presets must avoid repeated prompts within their scope. Provider writes remain unreachable.

For each named AI client, demonstrate its actual advertised delivery route and computer-off behavior. Before consumer rollout, observe people unfamiliar with API/MCP completing setup and record failures and requests for help.

## Dated source evidence

Official sources reviewed in the 2026-09-05 audit; recheck before each implementation:

- [ClickUp MCP](https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server): daily quotas depend on plan/add-on; OAuth client requirements.
- [ClickUp API](https://developer.clickup.com/docs/rate-limits): per-token API limits.
- [Asana MCP](https://developers.asana.com/docs/integrating-with-asanas-mcp-server): MCP-only tokens, separate API registration, broad MCP authorization.
- [Asana OAuth](https://developers.asana.com/docs/oauth): scoped API permissions.
- [OpenAI connections](https://developers.openai.com/plugins/deploy/connect-chatgpt): HTTPS/tunnel testing versus public endpoint submission.
- [OpenAI tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels): runtime and workspace/organization requirements.
- [Claude connections](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors): local extension versus remote delivery.
- [Google synchronization](https://developers.google.com/workspace/calendar/api/guides/sync) and [notifications](https://developers.google.com/workspace/calendar/api/guides/push): cursor recovery and HTTPS receiver requirements.

## Approval boundary

OD-22 requests acceptance of this exact design and the first synthetic lifecycle slice. Before production behavior, reconcile ADR-0003, INTEGRATIONS-SPEC, ARCHITECTURE, SPEC, and integrations-plan. OD-13 still requires concrete approval for services, live accounts, or costs. This proposal does not approve custom servers, hosting, provider writes, a marketplace, new dependencies, database migrations, account creation, or deployment.
