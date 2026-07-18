# ADR-0002: V1 personal work integrations

## Status

Superseded in part by ADR-0003 on 2026-07-18. The personal, read-only v1 product scope remains accepted; ADR-0003 replaces the transport and OAuth-boundary decisions.

## Context

Ascend cannot provide a useful picture of the user's work if tasks and meetings must be entered manually. The founder selected ClickUp and Asana for assigned tasks and wants both Google and Outlook calendars, with Google first if simultaneous calendar implementation expands risk.

Provider capability and authorization differ. Google documents an installed-app OAuth flow. Microsoft Graph supports personal and work/school calendars, but Microsoft organization consent policies add rollout cases. ClickUp and Asana expose the required task reads, but their documented public-app token exchanges require an application client secret that cannot be kept secret inside a distributed desktop binary.

## Decision

- Google Calendar, ClickUp assigned tasks, and Asana assigned tasks are required initial-v1 product capabilities.
- Outlook Calendar remains a planned next provider and must fit the same adapter and canonical event model without an architecture rewrite.
- Initial connectors are personal, read-only, explicit, revocable, source-linked, and private to the personal workspace.
- Only open tasks assigned to the authenticated person are imported by default.
- Calendar event descriptions and task descriptions/comments/attachments/custom fields are excluded by default.
- External provider records are never silently modified. Provider writes require a later approved specification.
- Provider records use namespaced external IDs, provenance, bounded idempotent synchronization, stale-state visibility, and deletion/unassignment reconciliation.
- Provider content is untrusted and cannot authorize actions or become executable instructions.
- Reusable provider client secrets are never embedded in the desktop app.
- Connection transport and OAuth custody follow ADR-0003.

## Alternatives considered

### Implement Google and Outlook simultaneously

- Advantage: broader calendar coverage at launch.
- Deferred: it doubles authentication/account-policy and calendar-adapter verification while the canonical behavior is still unproven. Google-first provides a smaller vertical slice; Outlook follows through the same contract.

### Import every visible task and full calendar/event content

- Advantage: richer context immediately.
- Rejected: it violates data minimization, increases prompt-injection and privacy exposure, and obscures the primary question: “What is assigned to me and what meetings do I have?”

### Allow task and calendar writes in the first connector release

- Advantage: users could manage work without leaving Ascend.
- Rejected for initial v1: remote mutation adds conflict, idempotency, authorization, and destructive-action risk. Read-first establishes trust and correct synchronization.

### Embed ClickUp/Asana client secrets in the desktop app

- Advantage: avoids an Ascend service.
- Rejected: distributed application secrets are extractable and the provider documentation requires them to remain secret.

### Require manual provider tokens for every public user

- Advantage: preserves a fully local architecture.
- Rejected as the target user experience: it is not an easy connection flow and creates support and token-handling risk. It may be used only for explicitly approved private development.

## Consequences

- V1 scope and acceptance criteria now include connected assigned tasks and Google Calendar meetings.
- The provider adapter and canonical models must not contain Google-, ClickUp-, or Asana-specific assumptions.
- Provider connections use the MCP-first/API-fallback gateway accepted in ADR-0003.
- Public provider connection still requires provider-app registration, a security-reviewed connection service where a confidential client secret is required, and explicit provisioning approval.
- Outlook is not an initial-launch blocker but remains an explicit next-provider commitment.
- Future organization-managed connections remain separate from personal connections and require a new specification.
