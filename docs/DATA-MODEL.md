# Migration 0001 Data-Model Specification

**Status:** Planned template — not yet specified or approved
**Owner task:** Task 5 in `tasks/todo.md`

## Approval gate

Do not write migration SQL, ORM models, or production repository code from this template. Task 5 must replace the open sections with exact tables, columns, constraints, lifecycle rules, and abuse-case tests, then obtain human approval before Task 6 begins.

OD-02 and OD-02A are resolved. OD-03 and the exact schema/security review must be resolved before implementation.

## Required conceptual boundaries

- **Actor:** stable identity for a person; not an email address, Windows account, role, or membership.
- **Tenant:** a personal or organization account and the top-level ownership/authorization boundary.
- **Workspace:** the primary data scope owned by exactly one tenant.
- **Workspace membership:** the actor-to-workspace relationship that carries role and lifecycle state.
- **Device:** stable installation/device identity, separate from the actor.
- **Work entity:** a later memory-domain object such as a person, client/company, or project. It is not a tenant and cannot authorize access.
- **Provider connection:** a revocable grant linking one owner actor and destination tenant/workspace to one provider, environment, external account, and selected external containers. It is neither an actor identity nor a workspace membership.

The exact schema must use distinct identifier types and names. An ambiguous `organization_id` cannot represent either concept.

## Exact items Task 5 must specify

- Table and column names, stable ID format, foreign keys, uniqueness, and check constraints
- Personal-tenant and personal-workspace bootstrap invariants
- Membership roles and states without embedding roles in actors
- Ownership and visibility meanings: personal, explicitly shared, workspace-owned, and organization-owned
- Tenant/workspace scope on every owned or shareable record
- Creation, update, deletion, tombstone, provenance, device, and UTC timestamp semantics
- Migration version, checksum, transaction, retry, corruption, and future-version behavior
- Data-at-rest behavior selected in OD-03
- Future cloud-identity mapping without changing existing record IDs
- Member-leaving, export, and organization-owned-data boundaries
- Personal integration connections keyed by owner actor, tenant, destination workspace, provider, deployment environment, external account, and selected provider workspaces/calendars
- Connection transport policy (`mcp` or `api`), provider-profile/capability version, MCP endpoint reference, allowed tool/scope identifiers, fallback route, health, and last route used
- Provider app-registration references by provider/environment without storing a reusable confidential client secret in the general database
- Credential custody reference and lifecycle state without placing token values in ordinary tables, logs, exports, or renderer-readable data
- Namespaced external IDs, canonical record type, provenance, sync cursors, fetched/last-seen timestamps, stale state, source URLs, route used, and disconnect/deletion behavior
- Audit fields for connection creation, consent, scope/tool changes, route fallback, refresh/revocation, future confirmation, and external operation results

## Required abuse-case tests

- Cross-tenant and cross-workspace reads, writes, search, export, cache, and file access are denied.
- A client/company work-entity ID cannot be accepted as a tenant ID.
- A role change affects the membership, not the actor identity.
- Repeated first-run bootstrap does not duplicate the actor, tenant, workspace, membership, or device.
- Unknown future migration versions and changed migration checksums fail visibly.
- Deletion and tombstones cannot silently orphan or transfer ownership.
- A provider task/event ID cannot be accepted as an Ascend tenant, workspace, actor, or work-entity ID.
- Repeated provider sync is idempotent; revocation or disconnect stops calls and removes credentials.
- A connection or credential reference cannot be resolved across actor, tenant, workspace, provider account, or environment boundaries.
- An inbound Ascend MCP client ID/credential cannot be accepted as an outbound provider connection ID/credential, or vice versa.
- A provider capability/schema change cannot silently enable an unapproved tool or write operation.
- MCP-to-API fallback preserves the same connection, ownership, canonical external ID, and read-only authorization semantics.

## Approval record

To be completed in Task 5:

- Proposed schema: Not written
- Security review: Not run
- Focused test list: Not approved
- Founder decision: Pending
