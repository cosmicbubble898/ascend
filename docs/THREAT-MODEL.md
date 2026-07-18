# Ascend Foundation Threat Model

**Status:** Foundation baseline approved on 2026-07-18; feature-specific threat models and named gates remain required
**Last updated:** 2026-07-18

## Purpose and scope

This document defines the security assumptions and mandatory controls for Ascend's individual v1 and its organization-ready foundations. It covers the local shell and engine, database and files, recordings, activity capture, provider calls, personal work integrations, OAuth, imports, MCP/local API access, LLM processing, and future workspace isolation.

It is not a claim that unimplemented controls already exist. Each control becomes a testable requirement when the related feature is specified.

## Assets

- Provider credentials and connector tokens
- Google, ClickUp, Asana, and future Outlook access/refresh tokens, OAuth state, and provider account identity
- Dictation and meeting audio
- Transcripts, summaries, notes, commitments, and imported documents
- Application/window activity and inferred productivity information
- Personal and future workspace memory
- Actor, device, membership, permission, and workspace identifiers
- Tenant-account identifiers and separate work-entity identifiers
- Voice profiles or embeddings
- Audit records, corrections, and provenance
- Imported assigned tasks, calendar events, source links, attendee identity, and sync metadata
- Installer, update packages, native helpers, and dependency lockfiles

## Trust boundaries

1. **Electron renderer to shell main process:** renderer content must not receive engine secrets or unrestricted native access.
2. **Shell to Python engine:** loopback communication still crosses a process boundary and requires authenticated, validated messages.
3. **External MCP/API client to engine:** each client may be malicious, compromised, over-permissioned, or confused about workspace scope.
4. **Engine to SQLite/files:** every access must pass through the data-access and media-storage boundaries with explicit workspace/owner context.
5. **Engine to cloud provider:** audio, text, metadata, credentials, responses, cost, retention, and availability leave local control.
6. **Imports/retrieval to memory and LLM context:** documents and transcripts may contain malicious instructions, oversized payloads, or poisoned content.
7. **LLM output to product behavior:** model output is probabilistic untrusted data, not authority or executable intent.
8. **Windows capture and clipboard interfaces:** device churn, focus changes, other applications, and clipboard contention can cause disclosure or incorrect actions.
9. **Future personal-to-organization sharing:** an incorrect tenant/workspace scope or role check could disclose one person's private work to another member or manager.
10. **Build and update supply chain:** dependencies, install scripts, donor files, native binaries, and update artifacts can execute with user privileges.
11. **Tenant account versus work entity:** confusing an organization tenant with a client/company entity could turn ordinary memory references into authorization decisions.
12. **Desktop to system browser/provider OAuth callback:** callback injection, state replay, wrong-account binding, embedded secrets, or malicious redirects could expose a provider account.
13. **Engine to task/calendar providers:** authorized MCP servers and APIs return untrusted content/tool metadata, partial pages, rate limits, revocation, schema drift, and records belonging to multiple users/workspaces.
14. **Desktop/system browser to Ascend connection service:** the approved confidential OAuth boundary becomes a high-value secret, token, callback, abuse, and availability boundary even though provider content must not pass through it by default.
15. **Inbound Ascend MCP versus outbound provider MCP:** conflating client grants, tool registries, or audit context could let one integration inherit another integration's authority.

## Primary abuse cases and required controls

| Abuse or failure                                                                      | Required control                                                                                                                                                                       | Required evidence                                                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A local process impersonates the shell or MCP client                                  | Random session credentials, per-client token hashes, loopback-only binding, revocable scopes                                                                                           | Wrong/missing token tests and client-revocation tests                                         |
| A compromised renderer reaches Node, native APIs, or broad engine actions             | Context isolation, sandbox, no Node integration, no remote content by default, narrow typed preload bridge, sender validation, allowlisted IPC                                         | Configuration assertions and unknown/wrong-sender IPC tests                                   |
| A user or integration accesses another tenant/workspace by changing an ID             | Tenant/workspace context below the UI, membership authorization on every protected operation, scoped queries and caches                                                                | Cross-tenant/workspace read/write/search/export denial tests                                  |
| A tenant account ID is confused with a client/company work-entity ID                  | Separate types, tables, identifier names, repositories, and authorization paths; no overloaded `organization_id`                                                                       | Type/schema checks and adversarial ID-confusion tests                                         |
| A manager gains private employee activity through analytics                           | Personal-by-default classification, explicit sharing, separate aggregate policy, no manager override of personal scope, no individual rankings or timelines                            | Privacy-policy tests and representative role/visibility matrix                                |
| An external client silently edits memory                                              | Inbox-only writes with explicit acceptance; no direct external update/delete path                                                                                                      | API/MCP contract and repository tests                                                         |
| Imported text or a prompt tells Ascend to reveal data or run an action                | Treat content as data, separate instructions from content, enforce permissions in code, validate structured outputs                                                                    | Prompt-injection and poisoned-document abuse tests                                            |
| Model output becomes SQL, HTML, shell input, a file path, or a permission change      | Allowlisted typed schemas, parameterized queries, encoded rendering, no `eval`, no direct tool execution                                                                               | Malformed/adversarial model-output tests                                                      |
| File import escapes its allowed directory or exhausts storage                         | Canonicalized paths, allowed-root enforcement, magic-byte/type checks, size/count limits, bounded extraction                                                                           | Traversal, archive-bomb, wrong-type, and oversize tests                                       |
| Secrets or sensitive content enter logs                                               | Field allowlists, redaction, content-free error events, no prompt/audio/transcript logging by default                                                                                  | Secret-shaped-value and content-redaction tests                                               |
| Remote diagnostics silently transmit work behavior or content                         | Remote telemetry off by default; approved opt-in specification, content-free schema, visible disable control                                                                           | Default-off test, payload allowlist test, and consent-state test before any telemetry ships   |
| Recording starts without informed action                                              | Confirmation, visible persistent indicator, live track status, indicator-gap event                                                                                                     | Recording-state and indicator-failure tests                                                   |
| Focus changes while dictation is being processed                                      | Recheck target window before paste; hold text and notify instead of guessing                                                                                                           | Focus-change regression test                                                                  |
| Clipboard contention loses or leaks text                                              | Bounded retry, history/cloud exclusion where supported, restore prior clipboard, leave text safely with notice on failure                                                              | Busy-clipboard and restoration tests                                                          |
| Cloud provider is unavailable, compromised, or returns unexpected data                | TLS, provider allowlist, timeouts, bounded retries, response validation, visible fallback, no automatic privilege                                                                      | Failure, timeout, malformed-response, and cost-limit tests                                    |
| Product claims hide cloud transfer, retention, or unsupported AI-client behavior      | Operation-level data-flow disclosures, current provider-term review, per-client compatibility evidence, claim allowlist                                                                | Dated provider/client review and claim-to-test traceability                                   |
| Requests, models, imports, or background jobs consume unbounded resources             | File/request/token/time/retry/queue limits, cancellation, pagination, incremental work                                                                                                 | Limit and cancellation tests                                                                  |
| A malicious dependency or donor file executes during setup                            | One authoritative lockfile, install scripts blocked until reviewed, official-source verification, no wholesale donor copy                                                              | Clean reproducible install and dependency review record                                       |
| Update artifacts are replaced                                                         | Signed artifacts, checksum/signature verification, atomic update and rollback                                                                                                          | Tampered-update and interrupted-update tests before distribution                              |
| An OAuth callback binds the wrong account or replays a code                           | External system browser, exact redirect allowlist, unguessable session-bound state, PKCE where supported, short callback lifetime, one-time code                                       | Wrong/expired state, redirect, account, replay, and verifier tests                            |
| A reusable provider client secret is extracted from the desktop binary                | Keep confidential provider credentials only in the security-reviewed connection service/provider boundary; never distribute them                                                       | Source, artifact, package, config, log, crash, and renderer secret scans                      |
| A provider advertises write tools or broader capability than v1 approved              | Deny-by-default local tool/scope/operation allowlist; initial-v1 contains reads only                                                                                                   | Enumerate advertised tools and prove every write or unknown tool is unreachable               |
| Provider MCP capability or tool schema changes unexpectedly                           | Validate expected capabilities and typed schemas, fail closed, expose diagnostics, and use only a contract-tested API fallback                                                         | Missing/renamed/changed/oversized tool-schema and fallback tests                              |
| An inbound Ascend MCP grant is reused for an outbound provider call, or vice versa    | Separate credential stores, client registries, permission evaluation, rate limits, and audit namespaces                                                                                | Cross-boundary credential/tool substitution denial tests                                      |
| One user's provider token is used by another user, workspace, account, or environment | Bind credential lookup and jobs to actor, tenant, workspace, provider, external account, and environment; deny ambiguous lookup                                                        | Cross-actor/account/tenant/workspace/environment token tests                                  |
| ClickUp/Asana returns tasks for another user or unauthorized workspace                | Bind provider account identity, allowlisted provider workspaces, adapter-enforced signed-in assignee filter                                                                            | Other-user, unassigned, unauthorized-workspace, and multi-assignee tests                      |
| Task or calendar content injects instructions or markup                               | Treat all provider fields as inert untrusted data, field allowlists, encoded display, no instruction authority                                                                         | Malicious title/project/event/URL fixtures through UI, memory, and AI paths                   |
| Pagination/retry loops exceed provider or local limits                                | Page/item/time budgets, cursor validation, 429 backoff, cancellation, bounded reconciliation                                                                                           | Rate-limit, repeated-cursor, partial-page, timeout, and cancellation tests                    |
| Revoked or failed connections silently show old data as current                       | Visible last-success/stale state, stop jobs on revoke/disconnect, retain last good data without claiming freshness                                                                     | 401/403/revoke/disconnect/staleness tests                                                     |
| The Ascend connection service leaks tokens or becomes an open exchange proxy          | Separate approved design; provider/redirect/environment allowlists; state binding; encrypted secret store; no content logging; rate/abuse limits; key rotation and incident revocation | Required before service provisioning, provider registration, or deployment                    |
| Provider content or model output triggers an external write                           | Initial-v1 has no reachable provider writes; later writes require typed validation, exact preview, explicit confirmation, idempotency, verification, and audit                         | Read-only capability tests now; adversarial confirmation/replay tests before any future write |

## STRIDE summary

- **Spoofing:** local client impersonation, future member/session impersonation. Mitigate with scoped credentials and explicit actor/client context.
- **Tampering:** modified database, media, imports, IPC messages, or updates. Mitigate with validated interfaces, checksums, migrations, signatures, and append-only audit events.
- **Repudiation:** denial of sharing, external reads, permission changes, or AI actions. Mitigate with actor/client/workspace-aware audit records.
- **Information disclosure:** cross-tenant/workspace access, logs, prompts, exports, clipboard, provider retention, or plain local storage. Mitigate with least privilege, field allowlists, redaction, explicit sharing, and an approved at-rest posture.
- **Denial of service:** oversized imports, token/cost loops, provider retries, audio/device failures, or database scans. Mitigate with hard limits, timeouts, pagination, queues, and visible degradation.
- **Elevation of privilege:** role confusion, UI-only permission checks, prompt injection, overbroad MCP capabilities, or unscoped repository methods. Mitigate with centralized authorization below the UI, local tool allowlists, separate MCP trust domains, and adversarial tests.

## Data and privacy invariants

- Personal activity, private meetings, dictations, notes, and memory are not organization-visible by default.
- Every owned or shareable record has explicit owner, workspace, and visibility semantics.
- Tenant accounts and client/company work entities have separate models and identifiers.
- Organization analytics never expose private individual timelines or create employee rankings, productivity leaderboards, or hidden monitoring.
- Remote telemetry is off by default; local diagnostic logs do not contain prompts, transcripts, audio, window content, or secrets.
- Personal provider connections and imported records remain private to the owner's personal tenant/workspace unless deliberately shared under a future approved feature.
- Provider access is read-only in initial v1; Ascend cannot create, update, complete, reassign, or delete provider tasks/events.
- Every imported provider record has a connection, namespaced external ID, source, fetched/last-seen time, and visible stale/deleted state.
- No reusable Google, Microsoft, ClickUp, Asana, or other confidential client secret is embedded in a distributed desktop artifact.
- Provider user credentials are isolated per actor, tenant, destination workspace, provider account, and environment; no grant is shared implicitly.
- Ascend's inbound MCP/API grants and outbound provider MCP/API grants are separate and non-transferable.
- Provider-advertised capabilities never expand Ascend permissions; initial-v1 can invoke approved reads only.
- Voice embeddings, provider secrets, and excluded content are never serialized through general API, MCP, export, analytics, or logging paths.
- External writes remain pending until accepted by an authorized person.
- A member leaving an organization must not lose personal data or retain organization-owned data without an explicit export policy.
- Public claims must match implemented behavior, particularly storage encryption, deletion, cloud processing, provider retention, and recording consent.

## At-rest storage decision and residual risk

OD-03 remains unresolved. Plain SQLite and recording files expose sensitive content to disk theft, backups, malware, and any process running as the signed-in Windows user. A loopback API token does not protect against same-user malware, and DPAPI protects provider keys but not an otherwise plain database or audio file.

Until OD-03 is approved:

- Plain storage may contain synthetic development data only.
- Do not capture real meetings, real work activity, or private memory into the new application.
- Do not make claims that the database or recordings are encrypted.
- Keep database and media access behind single replaceable boundaries so the approved encryption design does not spread across the codebase.

Even with encryption at rest, Ascend cannot protect data from malware or another person operating inside an already unlocked Windows account. This residual risk must be stated honestly.

## Security gates by stage

### Before dependency installation

- Verify packages and versions from current official sources.
- Choose one package manager and authoritative lockfile per installation boundary.
- Block dependency install scripts until individually reviewed.

### Before migration 0001

- Approve OD-03 and the exact data model.
- Define actor, tenant, workspace, membership, device, visibility, audit, retention, and deletion semantics.
- Write cross-tenant/workspace isolation, ID-confusion, and migration abuse cases first.

### Before provider or MCP integration

- Confirm historical credential rotation.
- Define provider retention/training eligibility and content sent per operation.
- Implement strict client scopes, output validation, logging allowlists, rate/cost limits, and prompt-injection tests.
- Verify each named AI client's actual local connection behavior before advertising compatibility.

### Before task or calendar integration

- Follow approved `docs/INTEGRATIONS-SPEC.md`, ADR-0002 product scope, and ADR-0003 transport/credential architecture.
- Recheck official MCP maturity/endpoints/tools, API fallback, scopes, OAuth flows, rate limits, app-distribution/review rules, and provider terms.
- Approve OD-13's exact provider profile, connection-service boundary, callback domains, secret storage, token exchange/refresh, logging, abuse controls, availability, incident response, and cost before provisioning.
- Define connection ownership, route selection, local tool allowlist, credential storage, sync/reconciliation, stale state, disconnect, deletion, and external-ID semantics.
- Write fake-MCP/API contract, schema-drift/fallback, OAuth callback/replay, wrong-account/workspace, assignee-filter, pagination, rate-limit, prompt-injection, revocation, write-denial, and isolation tests first.
- Use synthetic fixtures and dedicated non-production accounts; no live account until app registration and credential handling receive explicit approval.
- Do not provision provider apps or the connection service until founder approval covers secrets, cost, hosting, callbacks, abuse, logs, availability, and incident response.

### Before installer or signing claims

- Obtain separate approval before certificate/service purchase.
- Sign every shipped executable and native helper when signing is enabled.
- Test the packaged skeleton on clean Windows machines and record SmartScreen/AV results.

### Before real-data dogfooding

- Satisfy the approved at-rest requirement.
- Verify recording consent/indicator behavior, exclusions, deletion, log redaction, backup risk, and provider disclosures.

### Before outside testers

- Complete a dedicated security review and dependency audit.
- Test tenant/workspace isolation even if the UI exposes only one personal workspace.
- Sign distributable binaries and verify update integrity.
- Publish accurate privacy and security wording based only on implemented controls.
