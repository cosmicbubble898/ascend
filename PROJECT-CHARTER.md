# Ascend Project Charter

**Status:** Active
**Last updated:** 2026-07-18

## Product vision

Ascend is a Windows-first productivity system that helps people work faster, understand how they work, and build a useful memory of their work. Its core experience combines dictation, bot-free meeting notes, productivity tracking, assigned tasks and meetings from connected work tools, a searchable work memory, and controlled connections to tools such as ChatGPT and Claude.

Ascend begins as an individual product. Its long-term direction is:

**Personal productivity assistant -> collaborative team memory -> organizational intelligence platform.**

Ascend must eventually support a startup with 20 members, a company with 100 members, or an organization with 500 or more members without rebuilding its identity, ownership, permissions, or data foundations.

## Initial product scope

Version 1 is for one person using Ascend on their own Windows computer. The priority is a dependable individual experience:

- Dictation into any application
- Bot-free meeting capture, transcripts, summaries, decisions, and action items
- Local activity and productivity tracking
- Personal read-only connections to ClickUp and Asana for the user's assigned tasks
- Google Calendar events and meetings in the initial v1 launch, with Outlook Calendar as the next provider through the same interface
- A searchable and correctable personal work memory
- MCP and local API access with reviewable external writes

Provider connections follow an MCP-first architecture with official API/webhook fallback. This is separate from Ascend exposing its own MCP server/API to approved AI clients. Initial provider connections remain read-only.

Team collaboration, organization administration, cloud synchronization, centralized billing, and enterprise controls are not version 1 features.

## Long-term team and organization direction

Later versions will let people join organizations and workspaces while retaining a personal Ascend space. An organization may contain multiple workspaces, teams, departments, projects, and hundreds of members.

In product language, an **organization** is a multi-member Ascend account. In architecture and storage, that account is a **tenant**. It is not the same thing as a client or company recorded inside the user's work memory; those are **work entities**. This distinction must remain explicit in schemas, APIs, permissions, search, and analytics.

Expected capabilities include:

- Organization creation and workspace management
- Member invitations, removal, suspension, and transfer
- Roles such as owner, administrator, member, and guest
- Shared meetings, projects, notes, tasks, commitments, and knowledge
- Cross-team search and organizational memory, subject to permissions
- Organization-managed integrations and AI access
- Centralized plans, billing, usage limits, and administration
- SSO, directory provisioning, retention policies, and audit exports when required
- Aggregated organizational insights that do not expose private employee activity or rank individual workers

## Governing privacy principle

**Personal data stays personal unless the user deliberately shares it.**

Joining an organization must not automatically expose a person's private dictations, screen activity, productivity timeline, private meetings, personal notes, or personal memory to managers or other members.

Every item must have an understandable ownership and visibility state, such as personal, explicitly shared, workspace-owned, or organization-owned. Sharing must be intentional, reviewable, reversible where practical, and recorded in an audit trail.

Personal provider connections and imported tasks/events are private to the personal workspace by default. Connecting a work account must never silently expose its data to a future organization or manager.

## Foundations that must be designed from the beginning

The following constraints apply even while version 1 has only one local user:

1. **Stable identity:** Do not treat the Windows account, email address, device, or database row number as the permanent identity. Use globally unique, stable IDs for actors, tenants, devices, workspaces, memberships, and records.
2. **A personal account has a workspace:** Model the first user's personal account as a personal tenant with a personal workspace, even if the version 1 interface never uses either technical term. This prevents team support from requiring a new ownership model.
3. **Explicit ownership:** Every user-owned or shareable record must have an owner and workspace scope. Records must not rely on an implicit “current user” baked into storage.
4. **Membership is separate from identity:** A person can belong to multiple tenant accounts or workspaces with different roles. Roles belong to memberships, not permanently to the person.
5. **Permission checks below the UI:** Authorization must be enforced in the data-access and API layers. Hiding a button is not a security boundary.
6. **Private by default:** Newly captured dictations, activity, meetings, and memory are personal unless the user chooses another destination or an organization-owned workflow clearly says otherwise before capture.
7. **Actor-aware audit history:** Important reads, writes, sharing actions, permission changes, imports, exports, and AI/tool access must record who or what acted, in which workspace, and when.
8. **Tenant- and workspace-scoped interfaces:** Database queries, background jobs, search indexes, caches, files, API endpoints, and MCP operations must be designed to operate inside explicit tenant and workspace context.
9. **Portable data boundaries:** Personal and organization-owned data must remain distinguishable so a member can leave an organization without losing personal work or taking organization-owned information.
10. **Sync-ready records:** Keep globally unique IDs, UTC timestamps, device IDs, migrations, provenance, gravestones, and append-only raw history so future multi-device and organization synchronization is possible.
11. **No organization-wide surveillance:** Team analytics may use appropriate aggregates under transparent policies. Ascend must not provide employee rankings, productivity leaderboards, hidden monitoring, or a manager-visible timeline of an individual's private applications, windows, meetings, dictations, or notes.
12. **Scale-sensitive design:** Avoid assumptions that all records fit in memory, that lists are unbounded, or that one process can scan every member's history. Interfaces should allow pagination, incremental processing, scoped search, quotas, and background jobs later.
13. **Separate tenant identity from work entities:** Use tenant/account concepts for ownership, administration, and authorization. Use work-entity concepts for people, clients/companies, and projects mentioned in memory. Never overload one `organization` model or `organization_id` field for both meanings.
14. **Source-linked connected records:** External tasks and calendar events keep provider/account IDs, provenance, source links, sync state, and tombstones. Provider IDs are namespaced and must never become Ascend authorization IDs.
15. **No embedded confidential secrets:** A distributed desktop binary must not contain reusable provider client secrets. Ascend configures provider applications once per environment where required, keeps confidential app credentials in a security-reviewed connection service, and requires separate founder approval before provisioning provider apps, cloud resources, credentials, or costs.
16. **Separate inbound and outbound MCP:** Ascend's MCP server/API for ChatGPT, Claude, and other clients is separate from Ascend acting as an MCP client for external providers. Grants, tools, credentials, permissions, and audit trails cannot cross those boundaries.
17. **Provider-neutral connection identity:** Every provider grant is bound to an actor, tenant, destination workspace, provider, environment, provider account, selected external containers, and scopes. A future organization connection must not require replacing this identity model.
18. **MCP-first, not MCP-only:** Prefer an official remote MCP route when it is production-suitable, but retain official API/webhook fallback for stable, least-privilege, and deterministic synchronization. Initial-v1 locally allowlists reads only, regardless of the write tools a provider advertises.

## Build-now versus build-later rule

Build the identity, ownership, workspace-scoping, permission seams, audit fields, and privacy boundaries early because changing them later would require invasive data migrations and API rewrites.

Do not build the full organization product during the individual release. Invitations, shared cloud storage, organization dashboards, SSO, SCIM, centralized billing, enterprise retention controls, and large-scale collaboration should be added only when their requirements are approved.

The goal is not to pre-build every enterprise feature. The goal is to avoid architectural decisions that make those features unsafe or prohibitively expensive later.

## Decision test for future work

Before approving a schema, API, search, storage, sync, analytics, or permissions change, ask:

1. Who owns this data?
2. Which workspace does it belong to?
3. Is it personal, shared, workspace-owned, or organization-owned?
4. Who can read, change, share, export, or delete it?
5. Is that permission enforced below the interface?
6. Is the acting person, device, integration, or AI client recorded?
7. What happens if the person joins another workspace or leaves the organization?
8. Can this operate safely with hundreds of members and much more data?
9. Does “organization” here mean an Ascend tenant account or a company/client inside work memory, and is the code unambiguous?
10. What external account and permission produced this record, is it still current, and can the user revoke and delete it?
11. Is this an inbound Ascend tool call or an outbound provider call, and are the credentials and permissions isolated?
12. What happens when the preferred provider transport is unavailable, changes schema, or exposes more capability than Ascend approved?

If these questions cannot be answered, the design is not ready for implementation.
