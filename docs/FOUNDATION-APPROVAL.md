# Ascend Foundation Approval

**Status:** Foundation, integration architecture, and stack proposal approved on 2026-07-18; Task 2 authorized; OD-03 storage and OD-04 credential status remain open
**Prepared:** 2026-07-18
**Last updated:** 2026-07-18

## What this approval covers

The founder approved the product foundation, organization-ready seams, proposed process architecture, quality/security process, risk-first sequence, personal integration scope, MCP-first/API-fallback integration architecture, and `docs/STACK-VERSION-PROPOSAL.md`. This authorizes Task 2's minimal Python package and quality skeleton.

It authorizes only the approved Python dependencies needed by Task 2. It does not authorize product behavior, a database, Task 3/Electron dependencies, provider apps, callback domains, connection-service/cloud resources, real credentials, real-data capture, GitHub publication, deployment, or production changes.

On 2026-07-18, after Task 2 completed, the founder authorized continued execution of the existing written task sequence while away. This authorizes moving through those tasks one verified task at a time. It does not supply a missing open-decision value, authorize purchases, real credentials, real user data, destructive database work, provider/cloud resource creation, deployment, or production changes. Those named gates remain in force.

## Recommended foundation

### A. Product scope

Approve Ascend v1 as an individual, Windows-first productivity product covering dictation, bot-free meeting notes, local productivity tracking, assigned tasks from ClickUp and Asana, Google Calendar meetings, work memory, and permissioned MCP/local API access.

Team invitations, shared cloud workspaces, organization administration, centralized billing, SSO, SCIM, and enterprise reporting remain outside v1.

**Recommendation:** Approve.

### B. Organization-ready foundation

Approve ADR-0001: create stable local actor, personal tenant, personal workspace, owner membership, and device foundations from migration 0001; require owner/tenant/workspace scope and permission seams even with one user.

Approve the terminology boundary: a future multi-member Ascend organization is a tenant account; a person, client/company, or project stored in memory is a work entity. They must not share an `organization` model or ID.

This does not build team features. It prevents a future ownership and authorization rewrite.

**Recommendation:** Approve.

### C. Process architecture

Approve the proposed separation:

- Thin Electron/TypeScript shell for tray, windows, overlays, and supervision
- Hidden Python engine for product behavior and exclusive database ownership; exact runtime approval is delegated to `docs/STACK-VERSION-PROPOSAL.md`
- Native Windows helpers only where required
- Loopback-only authenticated shell/engine communication
- One tenant/workspace-scoped data-access layer and numbered migrations

Exact dependencies and versions will be researched from current official sources and proposed separately before installation.

**Recommendation:** Approve as the proposed architecture, with dependency approval still required.

### D. Quality and security process

Approve specification-first work, small tasks, behavioral TDD, current official-source dependency review, required checks before completion, security review for sensitive features, and no code before an approved spec/task.

Approve `docs/THREAT-MODEL.md` as the baseline that future features must refine with abuse cases and tests.

**Recommendation:** Approve.

### E. Risk-first sequence

Approve this order after the foundation and later per-task gates:

1. Current official-source stack/version proposal
2. Python and Electron quality skeletons
3. Early installer/signing/SmartScreen/AV spike, with separate approval before any signing purchase
4. Tenant/workspace data foundation and supervised process connection
5. Throwaway meeting-capture spike
6. Throwaway screen-context spike
7. First-hour/BYOK usability study before production onboarding/dictation work
8. Personal work integrations under the separately approved integration plan
9. Other separately specified production feature milestones

Spike code is not production code and cannot bypass TDD, quality review, or security review.

**Recommendation:** Approve.

### F. Personal work integrations

Approve ADR-0002's product scope, ADR-0003's transport/security decision, and `docs/INTEGRATIONS-SPEC.md`:

- Google Calendar is required for initial v1.
- ClickUp and Asana are required for the authenticated person's open assigned tasks.
- Outlook Calendar is the next provider through the same interface and is not an initial-launch blocker.
- Initial connectors are personal, private-by-default, source-linked, revocable, and read-only.
- Task/calendar descriptions, comments, attachments, custom fields, and remote writes are excluded initially.
- Ascend is an MCP client for provider connections and separately exposes its own MCP server/API to authorized AI hosts.
- Provider connections are MCP-first with official API/webhook fallback; Google Calendar and Outlook use stable APIs while their MCP services remain preview-stage.
- Ascend configures provider applications once per provider/environment where required; each user completes their own provider consent.
- Reusable provider secrets stay in a secure Ascend connection service and never ship in the desktop app.

**Recommendation:** Approve.

### G. Provider transport and OAuth boundary (OD-12) — approved

Approved as ADR-0003:

- MCP-first with official API/webhook fallback, not MCP-only.
- One Ascend provider app registration per provider/environment where required; one seamless provider consent per user/account.
- A minimal secure connection service handles confidential code exchange/refresh where required; provider content does not pass through it by default.
- Per-user tokens and grants are never shared, and no reusable provider client secret is embedded in the desktop app.
- Initial-v1 remains read-only even when remote MCP exposes write tools.

Exact provider apps, service hosting, callbacks, secrets, logging, abuse controls, cost, and live use remain gated by OD-13 and explicit approval.

### H. At-rest storage posture — selection required

Choose one:

1. **Recommended:** Plain storage is allowed only for synthetic development data. Encryption is required before Ascend stores real meetings, activity, transcripts, or work memory.
2. Plain storage is allowed for founder-only real-data dogfooding with explicit risk acceptance; encryption is required before any outside tester.
3. Plain sensitive storage may continue through public v1. This is not recommended because Ascend stores high-sensitivity audio, activity, and memory.

Provider credentials remain DPAPI-protected under every option.

### I. Historical credentials — status required

State one:

- Rotated/revoked and confirmed
- Not yet rotated/revoked
- Unknown; needs verification

This does not block approval of the documents. It blocks all real provider integration testing until resolved.

### J. Public repository and deployment operations — approved 2026-07-18

- Publish Ascend as the public GitHub repository `cosmicbubble898/ascend`.
- Repository initialization, commits, pushes, and later deployment operations are authorized for approved work after relevant security, quality, and release gates pass.
- Public visibility requires secret/privacy scanning and excludes local tools, dependencies, builds, runtime data, recordings, models, logs, crash dumps, credentials, and user data.
- This approval does not choose an open architecture or storage option, authorize signing spend or recurring cloud cost, permit real credentials/data, or bypass an approved specification.

## Remaining founder response

The approved sections do not need to be reconfirmed. Before the named blocking points, record:

```text
Storage: Option 1
Credentials: [confirmed / not yet / unknown]
```

Task 1 official-source stack/version research may proceed now. No dependencies will be installed until the resulting proposal is approved.
