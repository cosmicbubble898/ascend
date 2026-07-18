# ADR-0001: Individual-first, organization-ready foundations

## Status

Accepted in principle on 2026-07-18. Exact schema requires specification approval before implementation.

## Context

Ascend launches as an individual Windows productivity product. The intended future includes startups, teams, and organizations with tens or hundreds of members, multiple workspaces, shared memory, administrators, permissions, integrations, and centralized management.

A purely single-user schema would be quicker initially but would embed ownership assumptions into every table, query, file, API, search index, and background job. Retrofitting organizations later would require invasive migrations and create a high risk of leaking one member's private work to another member or manager.

Building the full organization product now would slow the individual release and force decisions about cloud identity, synchronization, billing, and enterprise administration before those requirements are understood.

## Decision

Use an individual-first, organization-ready design:

- The first user's account is represented as a personal tenant with a personal workspace.
- A stable local actor represents the user without requiring a cloud account.
- Actor, tenant, workspace, membership, device, and record IDs are globally unique and stable.
- Ownership, tenant scope, and workspace scope are explicit on every user-owned or shareable record.
- Workspace membership connects an actor to a workspace and carries the role; roles are not permanent properties of a person. Tenant-level administration may be added later without redefining actor identity.
- Data-access, API, search, background-job, file, and audit interfaces accept explicit tenant and workspace context.
- Personal capture is private by default and requires deliberate sharing.
- Important operations record the acting actor or client and the relevant tenant and workspace.
- A tenant account is structurally distinct from a work entity. People, client/companies, and projects inside memory must not share the tenant-account model or identifier namespace.

V1 will not implement team invitations, shared cloud synchronization, organization administration, centralized billing, SSO, SCIM, or enterprise reporting.

## Alternatives considered

### Build a truly single-user local schema

- Advantage: fewer initial tables and parameters.
- Rejected: ownership and authorization would have to be added across the whole system later, with unsafe and expensive migrations.

### Build the complete organization platform immediately

- Advantage: team features could launch sooner after the individual product.
- Rejected: it would expand v1 dramatically and force premature cloud, billing, identity, and policy decisions.

### Add nullable organization fields later

- Advantage: appears to preserve a simple v1.
- Rejected: scattered nullable fields do not create a coherent ownership, membership, permission, or workspace model and encourage accidental unscoped queries.

### Use one organization model for tenant accounts and client/company entities

- Advantage: fewer names and possibly fewer tables at first.
- Rejected: it mixes an authorization boundary with user content, making permission checks, imports, search, deletion, and future synchronization ambiguous and unsafe.

## Consequences

- Migration 0001 will include minimal actor, personal tenant, workspace, workspace-membership, and device foundations.
- Every relevant repository and service method carries tenant and workspace context even though v1 has one personal tenant and workspace.
- Tests must prove that a record from one tenant or workspace cannot be read or modified through another tenant/workspace context.
- The later work-memory schema must use a separate work-entity concept for people, clients/companies, and projects.
- Some v1 code is slightly more explicit than a purely single-user application.
- Future organization features can extend the model without redefining ownership or silently converting personal data into company data.
- Cloud identity and synchronization remain open designs; the local actor must be mappable without changing existing record IDs.
