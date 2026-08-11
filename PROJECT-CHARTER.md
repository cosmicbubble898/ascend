# Ascend Project Charter

**Status:** Active
**Last updated:** 2026-08-05

## Product vision

Ascend is a Windows-first personal development system whose first product wedge helps people work faster, understand how they work, and build a useful memory of their work. Its initial experience combines dictation, bot-free meeting notes, productivity tracking, assigned tasks and meetings from connected work tools, a searchable work memory, and controlled connections to tools such as ChatGPT and Claude.

Ascend begins as an individual work-productivity product. Its long-term direction has three compatible paths:

- **Personal ascent:** work -> mind -> body -> energy -> spiritual wellbeing, through optional private modules under the user's control.
- **Collaboration:** personal productivity assistant -> collaborative team memory -> organizational intelligence platform, using only deliberately shared or organization-owned work.
- **Agent OS:** personal copilot -> bounded action agent -> durable agent workspace -> one trusted interface coordinating approved cloud models, future local models, reusable skills, connectors, and specialist agents.

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

## Long-term personal direction

Future optional modules may support reflection, learning, focus, mental wellbeing, movement, yoga, sleep, habits, recovery, user-defined energy patterns, and spiritual practices. This is why the product is called Ascend: the long-term aim is to help a person ascend across work, mind, body, energy, and spiritual wellbeing without imposing a belief system.

These modules are not version 1 commitments. Health, wellbeing, voice identity, and spiritual-reflection data are more sensitive than ordinary work metadata. They require separate specifications, consent, retention, export, deletion, search, AI-processing, and sharing policies. Joining an organization must never make those personal domains visible to a manager, team, or organization.

## Long-term team and organization direction

Later versions will let people join organizations and workspaces while retaining a personal Ascend space. An organization may contain multiple workspaces, teams, departments, projects, and hundreds of members.

In product language, an **organization** is a multi-member Ascend account. In architecture and storage, that account is a **tenant**. It is not the same thing as a personal or professional subject represented inside memory. Those **memory entities/contexts** may include people, relationships, family, organizations/clients, projects, topics, goals, habits, places, events, health or wellbeing domains, and other life areas. They are user data, not authorization accounts. This distinction must remain explicit in schemas, APIs, permissions, search, and analytics.

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
13. **Separate tenant identity from memory content:** Use tenant/account concepts for ownership, administration, and authorization. Use separate memory-entity/context concepts for every personal or professional subject represented in memory. Never let a person, relationship, family item, organization/client, project, topic, goal, habit, place, event, health/wellbeing domain, or other life area become an account or authorization principal, and never overload one `organization` model or `organization_id` field for both meanings.
14. **Source-linked connected records:** External tasks and calendar events keep provider/account IDs, provenance, source links, sync state, and tombstones. Provider IDs are namespaced and must never become Ascend authorization IDs.
15. **No embedded confidential secrets:** A distributed desktop binary must not contain reusable provider client secrets. Ascend configures provider applications once per environment where required, keeps confidential app credentials in a security-reviewed connection service, and requires separate founder approval before provisioning provider apps, cloud resources, credentials, or costs.
16. **Separate inbound and outbound MCP:** Ascend's MCP server/API for ChatGPT, Claude, and other clients is separate from Ascend acting as an MCP client for external providers. Grants, tools, credentials, permissions, and audit trails cannot cross those boundaries.
17. **Provider-neutral connection identity:** Every provider grant is bound to an actor, tenant, destination workspace, provider, environment, provider account, selected external containers, and scopes. A future organization connection must not require replacing this identity model.
18. **MCP-first, not MCP-only:** Prefer an official remote MCP route when it is production-suitable, but retain official API/webhook fallback for stable, least-privilege, and deterministic synchronization. Initial-v1 locally allowlists reads only, regardless of the write tools a provider advertises.
19. **Hardware topology is dynamic:** Never assume one monitor, microphone, speaker, default device, scale factor, or permanent device ordering. Discover Windows devices through stable opaque identifiers, respond visibly to add/remove/default changes, and preserve explicit user choices without silently selecting different hardware.
20. **System changes are reversible and conservatively owned:** Dictation playback suppression must preserve the user's prior mute and volume choices, verify observable changes before claiming success, restore only state Ascend changed with no observed ownership conflict, and recover visibly from cancellation, device loss, process failure, or restart. Windows races that cannot be observed must be disclosed and minimized rather than described as impossible.
21. **Capabilities are separate from implementations:** Product modules request versioned capabilities such as transcription, language generation, capture, diarization, or calendar access. They do not depend directly on one cloud provider, model package, native library, or hardware backend.
22. **Local and cloud execution is explicit:** Every AI or capture result records which adapter, runtime, model/service, device class, and data-locality route produced it. Ascend never silently sends locally designated data to a cloud fallback.
23. **Dependency-heavy runtimes are isolated:** Future local models, CUDA/DirectML/Windows ML backends, and native helpers run behind supervised, resource-bounded worker interfaces without direct database, credential-store, MCP, or unrelated workspace access.
24. **Meeting records are capture-source neutral:** Local bot-free capture, a future cloud meeting bot, provider artifacts, and imports may produce one canonical meeting shape, but their consent, identity, completeness, and provenance remain distinct and visible.
25. **Sensitive personal domains are compartmentalized:** Health, wellbeing, voice-identity, and spiritual-reflection data never inherit work-search, organization, analytics, API, MCP, export, diagnostic, or AI access merely because those paths already exist for work data.
26. **Future visual context is local, explicit, and separately controlled (OD-20):** Preserve a future capability for user-approved screenshots to be captured and retained as encrypted local personal assets, then analyzed by an approved local vision or OCR worker. Screenshot capture is off by default, visible, pauseable, scoped by application/window/region, retention-bound, and never silently routed to cloud. Raw screenshots and derived visual context do not become organization-visible or generally available through search, API, MCP, export, or unrelated AI context by default.

The following Agent OS foundations are proposed under OD-19. They become approved architecture only when the founder accepts `docs/AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL.md` and ADR-0005:

27. **Skills are knowledge, not authority:** A skill is a versioned, reviewable instruction/resource bundle. It may declare required tools or data classes but cannot grant permissions, obtain credentials, install code, or expand its own authority.
28. **Models propose; Ascend authorizes and executes:** Model text and tool-call output remain untrusted proposals. Only Ascend's typed gateway may validate, authorize, preview, execute, verify, and audit a local or external operation.
29. **Agent runs are durable and bounded:** Every future run carries actor, tenant, workspace, purpose, data class, selected versions, policy snapshot, budgets, approvals, calls, receipts, checkpoints, and a terminal state. Recovery must reconcile uncertain writes rather than repeat them blindly.
30. **Context disclosure is separate from inference:** A context broker selects the minimum permitted memory for each model, skill, tool, or external agent. Retrieved content never becomes instruction authority merely because it appears in a prompt.
31. **External-AI relationships remain distinct:** Ascend using OpenAI/Anthropic or local model APIs, an approved ChatGPT/Claude client using Ascend MCP/API tools, and Ascend invoking a documented external-agent API are separate routes with separate grants and audit history.
32. **One interface does not mean one privileged provider:** Ascend owns identity, policy, memory, approvals, execution, and run history while providers remain replaceable. Browser automation, consumer-session cookies, and private endpoints are not foundational ChatGPT/Claude control paths.
33. **Sharing, installation, activation, and invocation are separate:** A personal, workspace, or organization skill remains private by default. Making a skill discoverable cannot silently install it, activate automatic use, grant tools, or expose its owner's runs or memory.
34. **Autonomy increases risk:** Scheduled and background runs use stricter policies than interactive runs. Silence is not consent, triggers grant no authority, and destructive, financial, identity, permission, recording, export, or device-control actions require separately approved controls.

## Build-now versus build-later rule

Build the identity, ownership, workspace-scoping, permission, audit, capability, provenance, failure, and sensitive-data-class seams early because changing them later would require invasive data migrations and API rewrites. Preserve the conceptual separation between model, skill, context, policy, tool, connector, approval, and run state, but do not pre-build speculative agent tables or runtime infrastructure.

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
9. Does “organization” here mean an Ascend tenant account or an organization/client represented inside memory, and is the code unambiguous? More broadly, could any personal or professional memory entity/context be mistaken for an authorization principal?
10. What external account and permission produced this record, is it still current, and can the user revoke and delete it?
11. Is this an inbound Ascend tool call or an outbound provider call, and are the credentials and permissions isolated?
12. What happens when the preferred provider transport is unavailable, changes schema, or exposes more capability than Ascend approved?
13. What product capability is requested, and is the provider/runtime implementation replaceable without changing domain meaning?
14. Did execution stay on the user-approved local/cloud route, and is the actual route recorded?
15. Could this make health, wellbeing, voice-identity, spiritual, or other private personal data reachable from work, organization, search, API, MCP, export, AI, or diagnostics?
16. Does this add executable code, a model artifact, native runtime, cloud bot, or resource demand that requires isolation, verification, rollback, and separate approval?
17. Is this reusable knowledge, a typed tool, an authenticated connector, an agent profile, a workflow, a trigger, or a durable run, and has the design kept those meanings separate?
18. What exact code-enforced grant authorizes the action, and can any skill, prompt, provider description, retrieved content, or model output broaden it?
19. What context will leave the device or workspace, to which provider or external agent, for what purpose and retention policy, and is that disclosure recorded?
20. If the operation pauses, times out, crashes, or restarts, how does Ascend determine whether a side effect already occurred before retrying?
21. Is human approval bound to the exact actor, run, tool, target, arguments/diff, data disclosure, policy, risk, cost, and expiry?
22. Is this Ascend using a model API, an external AI client using Ascend, or Ascend invoking an official external-agent API, and are the grants and audit trails isolated?
23. Would this design depend on browser automation, a consumer-session cookie, a private endpoint, or another brittle control surface instead of an official typed interface?
24. If a skill, agent, schedule, or workflow is shared with a team, what remains personal, who owns each version and run, and can organization policy restrict it without exposing private data?
25. Does this capture, retain, analyze, disclose, export, or delete screen pixels or derived visual context, and are local-only routing, encryption, capture visibility, exclusions, retention, and residual password/secret risk explicit?

If these questions cannot be answered, the design is not ready for implementation.
