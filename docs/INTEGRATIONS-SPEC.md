# Specification: Personal Work Integrations

**Status:** Integration architecture approved by the founder on 2026-07-18; implementation remains task-, security-, dependency-, and provider-registration-gated
**Last updated:** 2026-07-18

## Decision summary

Ascend v1 must show a person's currently assigned work and upcoming meetings without manual copying.

The initial product commitments are:

- **ClickUp:** the signed-in person's open assigned tasks.
- **Asana:** the signed-in person's open assigned tasks.
- **Google Calendar:** selected calendars and upcoming meetings/events.
- **Outlook Calendar:** the next calendar provider, designed into the contract but not an initial-launch blocker.
- **Slack:** a planned later provider profile, not an initial-v1 commitment.

The transport architecture is **MCP-first with official API/webhook fallback**. MCP is preferred when the provider's official remote server is production-suitable. A stable API route is used when MCP is preview-only, too broad for least privilege, or unsuitable for deterministic background synchronization.

Initial-v1 integrations are read-only. Ascend does not create, edit, complete, reassign, send, react to, or delete provider records even if the remote MCP server advertises those tools.

## Objective

After a seamless one-time account connection, a user can answer:

- What tasks are currently assigned to me?
- What is due or overdue?
- Which project, list, or workspace contains each task?
- What meetings and events do I have today and next?
- Is the data current, and where can I open the original record?

Connected records become permissioned, source-linked context for local search, work memory, meeting preparation, and approved AI queries.

## Two separate MCP boundaries

Ascend has two independent MCP roles:

1. **Ascend as a server:** ChatGPT, Claude, or another authorized client calls Ascend tools through Ascend's MCP server or API.
2. **Ascend as a client:** Ascend connects to ClickUp, Asana, Google, Slack, Microsoft, or another provider's remote MCP server.

Authorization granted to ChatGPT or Claude belongs to that host and cannot be reused by Ascend. Ascend obtains, stores, scopes, revokes, and audits its own provider grants. The inbound and outbound tool registries, credentials, permissions, rate limits, and audit records remain separate.

## Integration gateway contract

Provider business logic sits behind a provider-neutral `IntegrationGateway`.

Each `ProviderProfile` defines:

- Provider identity and capability/maturity version
- Preferred route: `mcp` or `api`
- Official remote MCP endpoint when available
- OAuth mode and provider app-registration reference
- Locally allowed MCP tools and API scopes
- API/webhook fallback and route-selection conditions
- Account, workspace, project, and calendar discovery
- Canonical task/event normalization
- Pagination, cursor, reconciliation, rate-limit, and retry behavior
- Health, stale-state, revocation, and disconnect behavior

The integration service is deterministic. A language model is not required to authorize, filter, synchronize, normalize, or mutate records. Provider tool descriptions and returned content are untrusted data.

MCP does not replace Ascend's synchronization responsibilities. Ascend owns bounded paging, canonical models, idempotency, periodic reconciliation, stale-state visibility, provenance, and audit.

## Provider routing and evidence

The following routing policy reflects official provider documentation reviewed on 2026-07-18 and must be re-verified immediately before implementation.

| Provider         | Initial route                                    | Fallback                                   | Current reason                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ClickUp          | Official remote MCP                              | REST API and webhooks                      | Remote MCP is public beta and supports OAuth 2.1/PKCE. A custom client may require ClickUp review/allowlisting; API/webhooks remain necessary for deterministic reconciliation and rate-limit resilience. |
| Asana            | Official V2 remote MCP                           | REST API                                   | V2 is generally available but requires a pre-registered OAuth MCP app and does not offer granular MCP scopes. The REST `tasks:read` route provides a narrower deterministic read fallback.                |
| Google Calendar  | Calendar API for production                      | Official remote MCP behind a feature route | Google's Calendar MCP service is Developer Preview. It requires a Google Cloud project and OAuth client, so it is not the stable production dependency for v1.                                            |
| Outlook Calendar | Microsoft Graph                                  | Work IQ Calendar MCP when production-ready | The Microsoft MCP route is preview and not intended as a production dependency. Graph is the stable provider contract.                                                                                    |
| Slack            | Route selected per use case after scope approval | Web API/Events or official MCP             | Slack MCP can support interactive tools, but app registration/admin cases and variable human-readable output make Web API/Events preferable for deterministic sync. Slack is not initial-v1 scope.        |

Route selection is configuration and capability policy. Changing transport must not change ownership, canonical records, permission enforcement, or user-visible behavior.

## Seamless OAuth and credential architecture

### App-level setup

- Ascend registers one OAuth/MCP application per provider and deployment environment where the provider requires it.
- Ascend's client IDs, confidential client secrets, callback domains, and provider review are configured once by the Ascend team. End users never create a developer app or enter Ascend's developer credentials.
- Provider app registration, allowlisting, OAuth verification, cloud resources, domains, costs, and live credentials require separate founder approval before creation.

### Per-user connection

- Each user clicks Connect, signs in on the provider's own page in the system browser, reviews the provider consent screen, and returns to Ascend.
- This is normally a one-time user action per provider account unless consent is revoked, scopes change, provider policy requires reauthentication, or an administrator blocks/approves the app.
- Ascend requests only the scopes required for the approved read-only feature, even if the MCP server exposes broader tools.
- The connection is bound to owner actor, tenant, destination workspace, provider, environment, provider account, selected external workspaces/calendars, and granted scopes.

### Secret and token custody

- Reusable provider client secrets live only in a security-reviewed Ascend connection service or another provider-approved confidential boundary.
- No reusable secret may appear in the desktop binary, renderer, browser storage, configuration bundle, repository, logs, crash reports, analytics, or support export.
- The connection service may perform authorization-code exchange and token refresh when a provider requires the confidential app secret. Provider task/calendar content does not pass through this service by default.
- Long-lived user credentials retained on the Windows device use the approved Windows credential boundary and are protected for the signed-in user. Tokens are never shared between users, accounts, tenants, workspaces, or environments.
- OAuth uses exact redirect allowlists, external-browser authorization, unguessable and expiring state bound to the initiating session, PKCE wherever supported, one-time code use, and fail-closed callback validation.
- Dynamic client registration is used only when the provider officially supports and permits it for Ascend's production case. It does not bypass review or allowlisting.

## User-visible scope

### Connections

- A Connections screen lists Google Calendar, ClickUp, Asana, and clearly labels planned providers.
- Each active connection shows account identity, selected provider workspaces/calendars, granted read access, route/health in diagnostics, last successful sync, stale/error state, and Disconnect.
- Connections are off until the user authorizes them.
- Disconnect stops jobs immediately, deletes local credentials, attempts provider revocation where supported, and lets the user delete imported records or retain them as visibly disconnected history.

### Assigned tasks

ClickUp and Asana import only open tasks assigned to the authenticated person in external workspaces the user selected.

Initial allowlisted fields:

- Provider, external account, and provider workspace
- Provider task ID and source URL
- Title
- Status/completed state
- Priority when available
- Due and start dates when available
- Project, Space, Folder, List, or equivalent container names
- Provider creation/update timestamps required for synchronization

Descriptions, comments, attachments, custom fields, other users' task lists, and unassigned workspace tasks are excluded by default.

### Calendar events

Google Calendar imports events from explicitly selected calendars for a bounded past/upcoming window.

Initial allowlisted fields:

- Provider calendar and event IDs
- Source URL
- Title
- Start, end, all-day state, and time zone
- Status
- Organizer and attendees when visible to the signed-in user
- Meeting link and location
- Provider update timestamp required for synchronization

Event descriptions and attachments are excluded by default. A later opt-in requires privacy, prompt-injection, and data-minimization review.

### My Work view

- Show current assigned, due-today, overdue, and upcoming tasks.
- Show today's and upcoming events in the user's local time zone.
- Filter by provider, external workspace/project, status, and date.
- Show provider, source link, last-sync time, and stale/error state on every imported record.
- Never make stale data look current after a provider failure.

## Ownership and organization-ready seams

- Every connection has an owner actor, tenant, destination workspace, provider, environment, external account ID, selected source containers, and explicit visibility.
- Personal connections import into the personal workspace and remain private there.
- Connecting an employer account does not make its content visible to a future Ascend organization.
- Future organization-managed connections may add administrator consent, shared destinations, service accounts, member offboarding, role-based visibility, and retention without replacing the v1 identity keys.
- Provider account identity is not an Ascend actor identity; links are explicit and auditable.

## Synchronization contract

- Initial sync is paginated and bounded by connection, selected workspace/calendar, date range, signed-in assignee, page/item count, and time budget.
- Background refresh is cancellable, rate-limit aware, and uses provider cursors, update timestamps, webhooks, or polling as the profile permits.
- Periodic reconciliation detects deletion, cancellation, completion, or loss of assignment missed by incremental updates.
- External IDs are namespaced by provider, environment, and provider account. Repeated sync is idempotent and cannot duplicate records.
- Imported records retain connection ID, source URL, provider timestamps, fetched-at, last-seen, route used, and stale state.
- A mid-sync MCP failure can use the approved API fallback only when both routes have equivalent authorization and normalization semantics; the route switch is logged.
- Provider 401/403, revoked consent, 429, timeout, capability/schema drift, malformed response, partial page, or fallback failure remains visible and never erases the last known good data automatically.

## Permission and future-write design

- The v1 runtime has a deny-by-default local allowlist containing only approved read operations.
- Provider-advertised tools, model suggestions, task text, event text, or MCP descriptions cannot add permissions.
- The gateway is structurally capable of later write operations, but all writes remain disabled until a separate approved specification and tests exist.
- Any future write follows: typed validation -> exact preview -> explicit confirmation -> idempotent execution -> result verification -> audit event.
- Deletes, bulk actions, messages, task completion, reassignment, and other high-impact operations require stronger controls or remain prohibited.

## Security abuse cases

- **Callback injection/replay:** reject wrong, expired, reused, mismatched-account, redirect, state, session, code, or verifier values.
- **Desktop secret extraction:** prevent confidential app secrets in artifacts and scan source, packages, configuration, logs, and crash output.
- **Cross-user token use:** bind every credential lookup and job to actor, tenant, workspace, provider account, and environment; deny ambiguous matches.
- **Overbroad MCP tools:** enforce the local allowlist before invocation and test that all write tools remain unreachable.
- **Capability/schema drift:** pin or validate expected capabilities, fail closed on incompatible changes, alert diagnostics, and use only a contract-tested fallback.
- **Prompt injection:** treat provider content and tool descriptions as inert, size-bounded data; never convert them directly into instructions or actions.
- **Wrong-person import:** verify provider identity and selected external workspace, then enforce signed-in assignee filtering during sync and normalization.
- **Resource exhaustion:** apply page/item/time/response-size limits, cancellation, provider-aware backoff, and visible partial failure.
- **Revoked consent:** stop jobs, clear local credential material, and require reconnection rather than silently retrying forever.
- **Connection-service compromise:** minimize stored secrets, encrypt them, isolate environments, redact logs, rate-limit exchanges, restrict redirects/providers, audit access, rotate keys, and maintain an incident/revocation path.
- **Future organization leakage:** enforce personal ownership below the UI and test cross-tenant/workspace denial for connections and records.

## Testing strategy

- Use fake MCP servers and recorded, redacted synthetic API fixtures; never commit real tokens or user content.
- Contract-test MCP initialization, capability discovery, tool schemas, auth errors, timeouts, schema drift, and fallback selection.
- Test OAuth state, callback, expiry, wrong-account, replay, cancellation, disconnect, refresh, revocation, and credential redaction before a live account test.
- Test each profile for pagination, duplicate records, unassignment/deletion, rate limits, malformed/oversized data, partial responses, stale state, and route equivalence.
- Prove every advertised provider write tool is denied in initial-v1.
- Test cross-actor, cross-tenant, cross-workspace, cross-provider-account, and cross-environment denial.
- Live smoke tests use dedicated non-production accounts only after OD-04, provider registration, scopes, connection-service security, and explicit human approval are complete.

## Success criteria

- A user can connect each initial provider through its own external consent page without entering developer credentials.
- Ascend shows only the signed-in person's open assigned tasks from selected ClickUp/Asana workspaces.
- Ascend shows selected Google Calendar events with correct local times and source links.
- Initial-v1 cannot invoke any provider write operation through MCP or API.
- Synchronization is bounded, idempotent, rate-limit aware, auditable, and visibly stale on failure.
- A provider route can fall back without changing canonical record or ownership semantics.
- Disconnect removes credential access and stops provider calls immediately.
- No connected record is shared outside the personal workspace by default.
- Outlook can be added through the same contract without changing canonical ownership or record models.

## Official sources reviewed on 2026-07-18

### ClickUp

- MCP connection and custom-client requirements: https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server
- MCP tools: https://developer.clickup.com/docs/mcp-tools
- OAuth server metadata: https://mcp.clickup.com/.well-known/oauth-authorization-server
- REST authentication: https://developer.clickup.com/docs/authentication
- REST rate limits: https://developer.clickup.com/docs/rate-limits

### Asana

- MCP V2 integration and OAuth registration: https://developers.asana.com/docs/integrating-with-asanas-mcp-server
- MCP tools: https://developers.asana.com/docs/mcp-tools-reference
- REST OAuth and scopes: https://developers.asana.com/docs/oauth
- Assigned-task API: https://developers.asana.com/reference/gettasks

### Google

- Google Workspace MCP configuration: https://developers.google.com/workspace/guides/configure-mcp-servers
- Calendar MCP configuration: https://developers.google.com/workspace/calendar/api/guides/configure-mcp-server
- Calendar API scopes: https://developers.google.com/workspace/calendar/api/auth
- Desktop OAuth: https://developers.google.com/identity/protocols/oauth2/native-app

### Microsoft

- Work IQ Calendar MCP preview: https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-calendar-work-iq
- Microsoft Graph calendar overview: https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview
- Supported account types: https://learn.microsoft.com/en-us/entra/identity-platform/v2-supported-account-types

### Slack

- Slack MCP server: https://docs.slack.dev/ai/slack-mcp-server/

## Remaining gates

- OD-03 must resolve at-rest encryption before real sensitive data or the migration implementation.
- OD-04 must confirm historical credential rotation before any live provider test.
- Provider app registrations, callback domains, verification/review, connection-service infrastructure, credentials, costs, and live-account access require a separate explicit approval.
- Exact scopes, tool allowlists, provider route, token storage/refresh, and threat cases must be re-verified and approved in the first provider implementation slice.
