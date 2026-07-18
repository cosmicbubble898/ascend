# Ascend Open Decisions

Agents must not guess these decisions. Resolve each item before its blocking point and record the answer in an ADR or approved specification update.

## Decisions resolved on 2026-07-18 and 2026-07-19

### OD-01 — Approve the v1 specification — resolved 2026-07-18

- **Decision:** The founder approved the v1 foundation and integration architecture and authorized Task 1 official-source stack/version research.
- **Boundary:** Dependency installation and application implementation still require approval of the Task 1 proposal. OD-03 and OD-04 retained their named gates; OD-03 was later resolved as recorded below.
- **Record:** `docs/SPEC.md`, `docs/FOUNDATION-APPROVAL.md`, and ADR-0003.

### OD-02 — Approve the minimal organization-ready schema principle — resolved 2026-07-18

- **Decision:** Yes. Migration 0001 will contain a local actor, personal tenant, personal workspace, owner membership, and device even though v1 has no team interface.
- **Boundary:** The exact migration and at-rest storage implementation remain specification- and OD-03-gated.
- **Record:** ADR-0001 and `PROJECT-CHARTER.md`.

### OD-02A — Approve tenant versus work-entity terminology — resolved 2026-07-18

- **Decision:** Yes. An Ascend personal/organization account is a `tenant`; people, clients/companies, and projects inside memory are separate `work entities`.
- **Invariant:** Never use one `organization` table, type, or ID for both the authorization boundary and a company/client mentioned in memory.
- **Record:** ADR-0001 and `docs/SPEC.md`.

### OD-15 — Public GitHub repository and deployment operations — resolved 2026-07-18

- **Decision:** Ascend's repository is public on GitHub. The founder authorized repository initialization, commits, pushes, and later deployment operations for approved, verified work.
- **Safety boundary:** Public-repository publication requires secret/privacy scanning and generated/runtime-data exclusions. Deployment authorization did not silently resolve other decisions; OD-03 and OD-14 were later answered explicitly. OD-04, OD-11, and OD-13 remain open, and no approval permits signing spend, recurring-cost resources, real credentials/data, or bypassing an approved specification and release gate.
- **Repository target:** `cosmicbubble898/ascend`.

### OD-03 — Confirm the v1 at-rest storage posture — resolved 2026-07-19

- **Decision:** Option 1. Plain SQLite/files may contain synthetic development data only. Encryption is mandatory before Ascend stores real work activity, meeting audio, transcripts, memory, or any outside tester's data.
- **Credential boundary:** Provider credentials remain DPAPI-protected from the first integration.
- **Boundary:** This permits synthetic migration work only after the exact data-model specification is approved. It does not authorize real data or make an encryption claim.
- **Record:** `docs/FOUNDATION-APPROVAL.md`, `docs/SPEC.md`, and `docs/THREAT-MODEL.md`.

### OD-14 — Windows installer fallback after Squirrel no-go — resolved 2026-07-19

- **Decision:** Approve the exact unsigned, local-only `electron-builder@26.15.7` NSIS proof around the unchanged prepackaged Forge output.
- **Boundary:** No signing spend, publishing, updater, web installer, custom NSIS script, real credentials, real user data, outside distribution, or deployment.
- **Record:** `docs/WINDOWS-INSTALLER-FALLBACK-PROPOSAL.md` and `docs/reviews/INSTALLER-SPIKE.md`.

## Blocking before application data or live integration work

### OD-04 — Confirm historical credential rotation

- **Question:** Have the previously exposed Deepgram, Anthropic, OpenRouter, Cloudflare R2, Fly.io, RunPod, Neon, Google OAuth, and Vercel Blob credentials been revoked or rotated?
- **Blocks:** Any provider integration test using real accounts.

## Blocking before the named feature

### OD-05 — Calendar provider sequence — resolved 2026-07-18

- **Decision:** Google Calendar is required for the initial v1 launch. Outlook Calendar follows through the same provider contract and is not an initial-launch blocker.
- **Reason:** Both are feasible. Google provides the smaller first vertical slice; Microsoft adds personal/work-school account types, multitenant registration, and organization-specific consent-policy cases.
- **Record:** ADR-0002 and `docs/INTEGRATIONS-SPEC.md`.

### OD-06 — Meeting import formats

- **Choices:** Transcript text only, or transcript plus audio files.
- **Blocks:** Import adapters.

### OD-07 — Meeting audio retention

- **Question:** Is 30 days the correct default before automatic deletion, with a user override?
- **Blocks:** Meeting media schema, storage estimates, and privacy wording.

### OD-08 — Free MCP/API read scope

- **Question:** Can free users read all personal memory, or only time/activity/calendar data?
- **Blocks:** Permission scopes and public pricing promises.

### OD-09 — Daily digest tier

- **Choices:** Free with the user's key, or Pro only.
- **Blocks:** Pricing and entitlement behavior.

### OD-10 — Starter credits

- **Question:** Will Ascend fund a limited first-quality experience before a user adds a provider key?
- **Blocks:** Onboarding, cost controls, and billing design.

### OD-11 — Code-signing certificate timing

- **Choices:** Purchase during early development or during the meeting milestone.
- **Recommendation:** Decide during early development and run the installer/signing/AV spike immediately after the skeleton. No purchase is authorized merely by approving the foundation.
- **Blocks:** Signed outside-test builds and SmartScreen reputation timeline.

### OD-12 — Provider OAuth and transport boundary — resolved 2026-07-18

- **Decision:** Ascend is MCP-first with official API/webhook fallback. It registers one provider application per provider/environment where required; every user completes their own provider consent. Reusable app secrets stay in a secure Ascend connection service or provider-approved confidential boundary and are never embedded in the desktop app. User credentials are bound per actor, tenant, workspace, provider account, and environment.
- **V1 boundary:** Provider integrations remain read-only even when an MCP server advertises write tools.
- **Content path:** The connection service handles code exchange/refresh only where needed; provider task/calendar content does not pass through it by default.
- **Record:** ADR-0003 and `docs/INTEGRATIONS-SPEC.md`.

### OD-13 — Connection-service and provider provisioning approval

- **Question:** Approve the exact hosting/environment model, callback domains, provider app registrations, secrets store, token exchange/refresh design, logging/redaction, abuse controls, availability target, incident response, and cost envelope.
- **Recommendation:** Decide this during the first provider implementation slice after its provider profile and scopes are re-verified from official sources.
- **Blocks:** Creating cloud resources or provider apps, storing live credentials, and connecting a live provider account. It does not block local stack research or synthetic adapter/contract tests.

## Future organization decisions

These do not block the individual release but must be specified before team development:

- Cloud identity provider and local-actor account linking
- Organization and workspace hierarchy
- Invitation and domain-claim rules
- Roles and custom permissions
- Personal-to-workspace sharing semantics
- Ownership when a member leaves
- Shared storage, synchronization, conflict resolution, and offline behavior
- Billing owner, seat counting, guests, suspensions, and plan limits
- SSO, SCIM, audit export, retention, legal hold, and data residency
- Aggregated productivity reporting and employee privacy constraints
