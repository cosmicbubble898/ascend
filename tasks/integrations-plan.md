# Implementation Plan: V1 Personal Work Integrations

**Status:** Architecture approved on 2026-07-18; no implementation, provider registration, connection service, dependency, credential, live-account access, or cloud resource is authorized
**Specification:** `docs/INTEGRATIONS-SPEC.md`
**Decision:** `docs/decisions/ADR-0003-mcp-first-provider-integration-gateway.md`

## Dependency order

```text
Approved ADR-0003 and integration specification
    -> current official MCP/API/OAuth/provider-policy verification
        -> canonical connection + provider-profile + task/event contracts
            -> fake remote MCP + fake API fallback TDD slice
                -> OD-13 connection-service/provider-provisioning specification and approval
                    -> Google Calendar API vertical slice
                    -> ClickUp MCP-first vertical slice + API/webhook fallback
                    -> Asana MCP-first vertical slice + REST fallback
                        -> unified My Work/search/memory context
                            -> security, reliability, and dedicated-account review
                                -> Outlook Graph follow-on specification
```

All provider profiles share canonical ownership, permission, synchronization, provenance, stale-state, and audit behavior. A transport route cannot bypass those rules.

## Phase I0 — Architecture and current-source verification

- [x] INT-0: Approve provider scope, read-only initial-v1, ADR-0003 MCP-first/API-fallback architecture, separate inbound/outbound MCP boundaries, and secure app-secret custody.
- [ ] INT-1: Immediately before implementation, recheck each provider's official MCP maturity/endpoints/tools, OAuth/app registration and review rules, exact read scopes, API/webhook fallback, rate limits, terms, and administrative-consent cases.
- [ ] INT-1A: Record the selected route and capability version for each initial provider; Google uses Calendar API in production while MCP is Developer Preview.

### Checkpoint

- [ ] Every requested field maps to an approved tool or documented API permission.
- [ ] The local allowlist contains only initial-v1 reads and explicitly denies every advertised write/unknown tool.
- [ ] No provider app, callback domain, connection service, credential, dependency, recurring cost, or live account exists without explicit approval.

## Phase I1 — Provider-neutral gateway specification

- [ ] INT-2: Specify and approve `ProviderProfile`, route selection, MCP capability validation, API fallback equivalence, canonical connection, external task/event, sync cursor, stale state, audit, and disconnect/deletion semantics.
- [ ] INT-3: Specify exact connection identity: owner actor, tenant, destination workspace, provider, environment, provider account, selected external containers, scopes/tools, route policy, and credential reference.
- [ ] INT-4: Write abuse cases and behavioral tests before production code, including cross-user token substitution, inbound/outbound MCP confusion, schema drift, write-tool denial, prompt injection, wrong assignee/workspace, and route fallback.

### Checkpoint

- [ ] The approved design preserves organization-ready identity and private personal ownership without implementing team features.
- [ ] MCP/API transport cannot alter authorization or canonical record identity.
- [ ] Token values and reusable app secrets have no field in the general application database.

## Phase I2 — Synthetic transport and fallback slice

- [ ] INT-5: With TDD, build a fake remote MCP server/client path covering initialization, capability discovery, an allowlisted paginated read, malformed/changed schema, timeout, rate limit, and disconnect.
- [ ] INT-6: With TDD, build a fake official-API fallback returning equivalent canonical records and prove deterministic route selection and idempotent import.
- [ ] INT-7: Add structural redaction/secret scans and prove unknown or write tools fail closed before any network call.

### Checkpoint

- [ ] Focused tests first fail for the expected missing behavior, then pass with the minimum implementation.
- [ ] Cross-actor/tenant/workspace/provider-account/environment denial passes.
- [ ] A mid-sync route failure is visible and never duplicates, erases, or silently marks stale data as current.
- [ ] No real token or provider content appears in source, fixtures, logs, renderer state, database, or test output.

## Phase I3 — Connection service and provider provisioning gate

- [ ] INT-8: Under OD-13, specify exact service hosting/environments, callbacks, provider app registrations, secrets manager, token exchange/refresh, local credential handoff/storage, logging/redaction, abuse limits, availability, key rotation, incident revocation, cost, and data-flow disclosure.
- [ ] INT-9: Obtain founder/security approval before creating any provider app, cloud resource, domain, credential, or recurring cost.
- [ ] INT-10: With synthetic credentials, test state/PKCE/callback binding, expiry/replay, wrong account/environment, refresh, revocation, log redaction, and failure recovery before a live account is used.

### Checkpoint

- [ ] Users never enter Ascend developer credentials; each user authorizes their own provider account in the provider's system-browser consent page.
- [ ] Reusable app secrets exist only in the approved service/provider confidential boundary and never ship in desktop artifacts.
- [ ] Provider task/calendar content bypasses the connection service by default.
- [ ] OD-04 is confirmed before any dedicated live-account smoke test.

## Phase I4 — Google Calendar vertical slice

- [ ] INT-11: With TDD, implement external-browser Google connect/disconnect and selected calendars through the approved OAuth boundary and stable Calendar API route.
- [ ] INT-12: With TDD, import bounded Google events and display today's/upcoming meetings with source links, correct time zones, stale state, and failure recovery.
- [ ] INT-13: Keep Google's Developer Preview MCP route behind the same profile and disabled for production until a current source review and contract tests approve it.

### Checkpoint

- [ ] Google requests only approved read scopes.
- [ ] Event sync is paginated, idempotent, bounded, and visibly stale on failure.
- [ ] Revocation/disconnect removes credential access and stops jobs.

## Phase I5 — Assigned-task vertical slices

- [ ] INT-14: With TDD, connect ClickUp through official remote MCP, validate/allowlist only read tools, and select provider workspaces.
- [ ] INT-15: Import only the authenticated person's open ClickUp tasks; contract-test REST/webhook fallback and reconciliation.
- [ ] INT-16: With TDD, connect Asana through official V2 remote MCP, enforce the local read allowlist, and select provider workspaces.
- [ ] INT-17: Import only the authenticated person's open Asana tasks; contract-test least-privilege REST fallback and reconciliation.

### Checkpoint

- [ ] Unassigned, other-user, unauthorized-workspace, closed/completed, duplicate, deleted, and unassigned-after-sync cases are tested.
- [ ] MCP capability/schema drift, API fallback, rate limit, pagination, token expiry/revocation, partial response, and malformed/oversized data are visible and bounded.
- [ ] Every provider create/update/complete/reassign/delete tool and endpoint is unreachable in initial-v1.

## Phase I6 — Unified context and release review

- [ ] INT-18: Add source-linked connected tasks/events to permissioned My Work, local search, and approved AI context without broadening client scopes.
- [ ] INT-19: Complete integration security and code-quality reviews plus explicit dedicated-account live smoke tests; publish accurate data-flow, consent, staleness, and disconnection wording.
- [ ] INT-20: Write the Outlook Calendar follow-on specification using Microsoft Graph until the MCP route is production-ready.
- [ ] INT-21: Treat Slack as a separately approved later provider profile; choose official MCP versus Web API/Events per use case rather than adding it implicitly to v1.

### Release checkpoint

- [ ] Initial-v1 success criteria in `docs/INTEGRATIONS-SPEC.md` pass.
- [ ] No provider write is reachable.
- [ ] No reusable provider client secret is embedded in distributed artifacts.
- [ ] No unresolved critical security, correctness, privacy, schema-drift, fallback, or rate-limit issue remains.
- [ ] Human review approves the integration milestone.

## Future write milestone — not authorized for v1

If provider writes are later proposed, create a separate specification and tests for typed intent validation, exact preview, explicit user confirmation, idempotency/replay protection, conflict handling, result verification, audit, and stronger controls for destructive/bulk actions. Do not expose write tools merely because a remote MCP server advertises them.

## Risks and mitigations

| Risk                                                           | Impact                               | Mitigation                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop artifacts expose app secrets or user tokens            | Provider account compromise          | Keep reusable app secrets in the approved connection service; use the Windows credential boundary for retained user credentials; scan source/artifacts/logs |
| MCP is preview, unavailable, rate-limited, or changes schema   | Integration outage or incorrect data | Capability/schema validation, bounded failure, provider profile version, visible health, and official contract-tested API/webhook fallback                  |
| MCP advertises broad read/write tools                          | Excess disclosure or remote mutation | Deny-by-default local tool/scope allowlist; v1 write operations unreachable and tested                                                                      |
| Inbound Ascend and outbound provider MCP authority is confused | Privilege escalation                 | Separate credential stores, registries, scopes, rate limits, and audit namespaces with substitution-denial tests                                            |
| Another user's connection or tasks enter Ascend                | Privacy/correctness failure          | Bind credentials to full connection identity; verify provider identity and enforce signed-in assignee/workspace filters                                     |
| Stale data looks current                                       | Missed tasks or meetings             | Visible last-success/stale state, bounded retries, manual refresh, and periodic reconciliation                                                              |
| Provider content or tool text injects instructions             | AI/action compromise                 | Treat all returned content/metadata as inert untrusted data; encode output and enforce permissions in code                                                  |
| Retry, pagination, or fallback loops indefinitely              | Provider ban or resource exhaustion  | Cursor validation, page/item/time budgets, cancellation, provider-aware backoff, and one bounded fallback decision                                          |
| Provider verification/admin consent delays rollout             | Launch delay                         | Start approved registration planning early, keep actionable consent diagnostics, and avoid depending on preview MCP for production                          |
