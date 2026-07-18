# ADR-0003: MCP-first provider integration gateway

## Status

Accepted by the founder on 2026-07-18. This ADR supersedes ADR-0002 only for provider transport, OAuth delivery, and credential custody. Initial-v1 provider actions remain read-only.

## Context

Ascend needs simple user connections to task and calendar systems without locking the product to one provider protocol. ClickUp, Asana, Google Calendar, Slack, and Microsoft expose different combinations of remote MCP, REST APIs, webhooks, OAuth behavior, maturity, rate limits, and administrative approval.

MCP reduces provider-specific tool wiring, but it is not a synchronization system and it does not remove provider registration, scopes, consent, rate limits, schema normalization, or provider review. Some remote MCP services are preview-only, optimized for interactive AI use, or unable to provide the deterministic paging and reconciliation required by background sync.

Ascend also has two separate MCP roles:

- **Inbound to Ascend:** ChatGPT, Claude, or another authorized client calls Ascend's MCP server or API.
- **Outbound from Ascend:** Ascend acts as an MCP client and calls a provider's remote MCP server.

These roles, grants, credentials, and audit trails must never be conflated.

## Decision

### 1. Integration transport

- Ascend uses a provider-neutral `IntegrationGateway` with MCP as the preferred transport and an official provider API/webhook fallback.
- Each `ProviderProfile` records MCP endpoint and maturity, authentication mode, app-registration reference, allowed tools/scopes, canonical normalization, rate limits, synchronization strategy, and API/webhook fallback.
- A deterministic integration service invokes tools and APIs. A language model is not required for authorization, synchronization, filtering, or mutation.
- MCP supplies transport and capability discovery; Ascend still owns canonical task/event models, paging, idempotency, reconciliation, stale-state handling, and audit.
- A provider can be routed to its API first when its MCP service is preview-only or unsuitable for deterministic production sync, while preserving the same gateway contract.

### 2. Initial provider routing

- **ClickUp:** official remote MCP first; official API and webhooks provide fallback and deterministic reconciliation.
- **Asana:** official remote MCP first; the official REST API provides least-privilege and deterministic fallback.
- **Google Calendar:** official Calendar API is the production route while Google's MCP service is Developer Preview; MCP remains an interchangeable route behind the adapter.
- **Outlook Calendar:** Microsoft Graph is the production route until the Work IQ Calendar MCP service is production-ready.
- **Slack:** a planned provider profile, not an initial-v1 commitment. Use official MCP for interactive tools where appropriate and Web API/Events for deterministic sync.

Provider routing is configuration and capability policy, not business logic.

### 3. OAuth and credential custody

- Ascend creates one provider application registration per provider and deployment environment where required. Users never enter Ascend's provider client ID or client secret.
- Every user still completes provider consent for their own account. Authorization opens in the system browser and returns to a bounded Ascend flow.
- Reusable provider client secrets live only in a security-reviewed Ascend connection service or provider-supported confidential boundary. They are never shipped in desktop, renderer, browser, logs, telemetry, or repository files.
- User grants and tokens are bound to the owner actor, tenant, destination workspace, provider, provider account, selected external workspaces/calendars, scopes, and environment. They are never shared across users.
- Long-lived user credentials stored on the device are protected through the approved Windows credential boundary. A connection service may exchange or refresh tokens when the provider requires the app secret; provider task/calendar content does not pass through it by default.
- Dynamic client registration may be used only when officially supported and accepted for Ascend's production use. It does not override provider review, allowlisting, or application-registration requirements.
- Creating provider apps, callback domains, cloud services, credentials, or live connections remains a separate explicit approval and security gate.

### 4. Permission and mutation policy

- Initial-v1 connections are read-only even when a provider MCP server exposes write tools.
- Ascend enforces a local allowlist of tools, scopes, and operations. Provider-advertised capabilities do not authorize their use.
- Future writes require a separately approved specification and the sequence: validate typed intent, preview the exact change, obtain explicit user confirmation, execute once with idempotency protection, and append an audit event.
- Destructive or high-impact actions require stronger confirmation or remain prohibited.
- Provider content is untrusted data and can never authorize a tool call, alter permissions, or bypass confirmation.

### 5. Organization-ready ownership

- The v1 UI is individual, but connection and record ownership includes actor, tenant, workspace, membership/permission seams, and provider account from the first migration.
- Personal connections remain private to the personal workspace.
- Future organization-managed connections, shared destinations, administrator consent, member offboarding, and retention require a separate specification, but must not require replacing the connection identity model.

## Alternatives considered

### MCP only

Rejected. Provider MCP maturity and deterministic-sync capabilities vary, and production operation requires API/webhook fallbacks.

### Direct APIs only

Rejected as the default. It duplicates tool wiring and fails to take advantage of official provider MCP services, though APIs remain essential fallbacks.

### Put provider secrets in the desktop app

Rejected. A distributed client cannot protect reusable confidential secrets.

### Reuse a user's ChatGPT or Claude connector authorization

Rejected. Those grants belong to the host product and do not authorize Ascend. Ascend obtains and audits its own provider grants.

### Enable all provider MCP tools immediately

Rejected. Advertised write capability is not product authorization. Initial-v1 remains read-only.

## Consequences

- Provider-specific work becomes a thin profile, canonical normalization, test fixtures, and fallback policy rather than a full independent architecture.
- Ascend needs a small secure connection service for providers that require confidential app credentials, plus an explicit provisioning and operations plan before it exists.
- Provider MCP capability/schema changes require contract monitoring and a safe fallback.
- Current stack research and local scaffolding may proceed without creating provider apps, cloud resources, credentials, or live connections.
- ADR-0002 continues to govern initial provider product scope and data minimization except where this ADR supersedes it.

## Verification required before implementation

- Re-check every provider's current official MCP, OAuth, API, scope, review, and rate-limit documentation.
- Approve the exact provider profile, requested scopes, redirect design, token lifecycle, and connection-service threat model.
- Contract-test MCP discovery/tool schemas and API fallback with synthetic fixtures.
- Prove cross-actor/tenant/workspace denial, token redaction, callback replay rejection, bounded sync, stale-state behavior, and read-only enforcement.
