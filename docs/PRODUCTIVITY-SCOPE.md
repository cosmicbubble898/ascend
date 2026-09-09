# Ascend productivity additions from Rize

**Product direction:** Founder clarification, corrected 2026-09-05.
**Implementation status:** Local file transcription and the first basic productivity slice are implemented; the remaining feature coverage is planned.
**Purpose:** Add relevant Rize features to Ascend's existing plan. Detailed behavior and delivery slices below are proposed implementation guidance.

## Relationship to the existing plan

The founder clarified that this exercise checks whether Ascend includes the critical Rize features relevant to its scope. The earlier documents remain the baseline: [project charter](../PROJECT-CHARTER.md), [specification](SPEC.md), [architecture](ARCHITECTURE.md), and existing ADRs. This document is an additive feature-coverage note, not a replacement charter or a reset of the long-term roadmap.

The team and organization platform remains a later phase, as described in the existing charter. Its identity, ownership, workspace, permissions, and privacy foundations remain relevant. The earlier wording in this note that removed that future platform was an incorrect interpretation and is withdrawn.

Ascend helps a person understand their work, improve habits, and reduce repetitive effort. Its productivity release includes the personal feature families requested after the Rize research: automatic capture, optional screen text/OCR, a correctable timeline, focus tools, project/client/task context, an in-product agent, reports, connections, and automation suggestions.

Optional OCR moves earlier into the personal productivity work. The in-product agent is also part of the requested feature coverage. Their first personal implementations can precede the later team platform and broader proposed Agent OS while using the existing architectural boundaries.

The targeted sequencing change is earlier optional OCR; it does not discard the previous vision or unrelated decisions. Features listed here are planned, not claims about the running application. The delivery order below is a proposal for this personal productivity phase, not a replacement for every existing milestone.

## What belongs in Ascend

| Area | Intended experience |
| --- | --- |
| Automatic activity capture | A useful workday history without starting a timer for every task. |
| Optional screen text/OCR beta | Richer context for understanding work that app names and titles cannot explain. |
| Categories and timeline | Understandable classifications and time blocks that the user can correct. |
| Focus and habits | Focus sessions, breaks, goals, patterns, and small changes whose results can be measured. |
| Projects, clients, tasks, unplanned work | Understand personal effort across planned responsibilities and unexpected work. |
| In-product agent and reports | Ask about work in plain language and inspect the records behind each answer. |
| Connections | Simple sign-in through reusable supported connectors/MCP, with visible permissions and connection health. |
| Repetition and automation | Find recurring work, explain a practical automation, and measure whether it helped. |

### 1. Automatic capture across monitors

Track the foreground app/window, timestamps, and permitted website context regardless of which attached monitor contains the active window. Handle display changes, idle periods, workstation lock, sleep, and resume. Provide a visible tracking state, pause control, working hours, and app/site exclusions.

One elapsed minute must not become several minutes because multiple monitors or overlapping sources are present. A visible window does not establish that the user read it. Idle input can mean reading, thinking, watching training, or attending a call; show uncertainty and allow correction rather than silently declaring that time wasted.

### 2. Optional screen text/OCR beta

Include opt-in local OCR early, after capture and storage work reliably. Start with a temporary image of the active window on the selected display, with clear controls for permitted apps and displays. Broader selected-screen context can be evaluated without treating every visible window as active work.

Process images locally and discard them after extraction; a retained screenshot gallery is a separate feature. Store only permitted text needed for the selected purpose, with encrypted local storage, retention controls, and deletion. Pause, exclusions, lock, and capture-status controls must apply to OCR as well as metadata. If the necessary source/exclusion checks cannot be made, skip capture and show the limitation.

OCR text can be inaccurate or sensitive. Show its source and allow deletion/correction. Filtering cannot guarantee detection of every secret. Do not silently send images or extracted screen text to a cloud model; any cloud agent context must follow the user's explicit data permissions. Keep the beta useful without requiring cloud OCR.

### 3. A trustworthy timeline

Group raw observations into understandable work blocks. Support category rules, manual labels, search/filtering, notes, manual/offline time, split/merge, duration correction, undo, and review of uncertain assignments. Distinguish observed activity, user-entered time, connector data, and inferred labels.

Corrections survive restart and recalculation. More specific user rules and explicit corrections take precedence over generic classifications. Totals reconcile with the timeline without overlapping double counts; capture gaps and stale connector data stay visible.

The user's role matters: WhatsApp may be legitimate client work, and switching between Slack, ClickUp, and a document may be one focused task. App identity or switching alone must not determine distraction or task completion.

### 4. Focus, habits, and behavior change

Include a session timer; planned focus, meeting, and break sessions; personal goals; working-hour boundaries; daily/weekly trends; optional break nudges; and configurable distraction reminders or blocking. Focus audio is useful personal-product polish after the core loop works.

Explain how focus metrics are calculated. Treat them as evidence about work patterns, not proof of the value of someone's output. Support different work styles and user feedback. Offer a small, relevant experiment such as batching ticket updates or protecting a morning focus period, then compare the user's own baseline with later results. Avoid unsupported claims of causation or precise time saved.

### 5. Projects, client tasks, and unplanned work

Allow manual project/client/task creation and links to authorized records from connected tools. Suggest attribution using rules, source references, and optional OCR; keep uncertain blocks reviewable. Capture work with no existing task as unplanned work, then let the user label it or propose a task in a connected tool.

Support personal effort breakdowns, task context, deadlines, and estimate-versus-actual effort where data exists. Clients and connected teams are context for the individual's work. They are not new Ascend tenants, billing accounts, or a requirement to invite colleagues.

### 6. In-product agent, personal reports, and routines

Provide a chat panel inside Ascend with useful starting questions:

- What did I work on today, and which entries support that?
- How much time went into this project or client's tickets?
- What unplanned work interrupted my priorities?
- Why did my week feel fragmented, and what could I change?
- What do my connected tasks say about this team's work and my responsibilities?
- Which repeated workflow is a candidate for automation?

Answers link to permitted timeline blocks, tasks, projects, and report periods. Calculate durations and totals in application code; use the model to explain supported results. Show missing coverage and stale sources. Do not infer other people's hours or productivity from the user's laptop activity.

Include daily/weekly personal reports, comparisons, scheduled in-app reviews/check-ins, saved personal prompts, follow-up questions, and chat history. User-requested corrections should be reviewable and reversible. These bounded functions do not require a general autonomous agent platform, public skills marketplace, or multi-agent runtime.

Keep the core timeline and statistics available locally without an LLM. Make the agent's local/cloud processing choice and context permissions understandable. Retrieved screen text, messages, tasks, and documents are data, not instructions that can grant tools or trigger actions.

### 7. Simple connections and an automation surface

Use one reusable outbound MCP connection layer and existing official/provider-supported servers where available. The normal experience is choose an app, sign in, review access, and connect. Offer custom MCP configuration for other compatible services. Use an official API fallback only where a concrete capability requires it; do not plan a bespoke integration project for every app.

Show supported reads/actions, scopes, stale data, reconnect, and disconnect in one Connections surface. Ascend's own MCP/API lets authorized external assistants use permitted Ascend data; it is separate from Ascend connecting outward. Support is determined by actual provider capabilities, not a promise that every app offers every action.

Find recurring workflow candidates from repeated, corroborated evidence. For example, a pattern involving WhatsApp, ClickUp, and Slack might suggest a reusable ticket-update workflow. This is an illustrative use case, not an observed fact about the user's activity. App switching alone cannot establish that a message was copied or a ticket resolved.

Each suggestion should explain the repeated steps, supporting examples, uncertainty, required connector capabilities, proposed action, and how to measure the result. Start with useful recommendations and reviewable recipes. Execute external actions only through the user's granted authority, with a visible result and failure handling; never act merely because captured content requests it.

## Current-phase exclusions and the later team platform

Client invoicing, billable rates, client profitability, and payroll are outside this personal productivity feature set. The Rize comparison does not make them Ascend requirements. This does not redefine Ascend's own future subscription or organization billing model.

Native team collaboration, shared workspaces, organization administration, and related platform capabilities remain later work under the existing charter. They are deferred from this personal phase, not removed from Ascend's roadmap. Preserve the existing prohibition on hidden monitoring, employee rankings, and exposure of private personal activity.

Authorized team information from connected tools remains in scope for personal questions and reports now. That context can be useful before Ascend implements its own team platform.

## Proposed personal-phase delivery order and proof of completion

These are implementation slices for the requested personal features, not a complete Ascend roadmap. Connections can be developed alongside the first features that need them. The existing longer-term personal, collaboration, and Agent OS directions remain in place.

| Order | Deliverable | Completion evidence |
| --- | --- | --- |
| 1 | Automatic transcript saving and a local library | A completed transcript survives restart, appears in history, can be reopened/deleted/exported, and shows save failures. Sensitive persistence is encrypted and uses a disclosed local location outside a cloud-sync folder. |
| 2 | Automatic activity capture and correctable timeline | A representative workday reconciles across displays, idle/lock/sleep events and gaps. Corrections persist; pause and exclusions stop collection. |
| 3 | Optional local OCR beta and project/task context | Consent, exclusions, display changes, extraction, retention/deletion, uncertainty, and attribution work on representative applications. |
| 4 | Focus tools, habit feedback, in-product agent, and personal reports | Questions cite real records and reconcile with computed totals. Goals and experiments can be reviewed over time; scheduled personal reviews respect settings. |
| 5 | Repeated-work suggestions and reviewed automations | Suggestions have corroborating examples; supported actions honor grants; outcomes and failures are visible; claimed improvement is measured. |

Dictation and meeting recording remain core Ascend pillars, delivered after this requested productivity work. Existing local file transcription stays usable throughout.

**Current reality:** Local English Parakeet transcription and sentence-aligned paragraphs work. The first productivity slice now provides Windows metadata capture, a daily timeline, categories/corrections, deterministic summaries, pause/exclusions, and encrypted automatic activity history; see [the basic productivity specification](BASIC-PRODUCTIVITY-SPEC.md). Transcript autosave, richer habits/coaching, optional OCR, connected tasks, and the in-product agent remain to be implemented. This coverage note preserves the earlier vision and the later team platform.

## Rize design references

Rize's [productivity page](https://rize.io/features/productivity) documents timers, planned sessions, focus metrics, break suggestions, distraction controls, and focus music. These inform the personal feature family; Ascend's metric definitions will be its own.

Rize's [privacy guide](https://rize.io/guides/privacy-and-security) describes optional Screen Vision OCR, including local or cloud processing. Ascend's initial OCR beta is designed for local processing with temporary images.

Rize's [agent guide](https://rize.io/guides/ai-agent-chat) documents in-app questions, record-linked answers, saved prompts, and report follow-ups. Ascend should provide comparable personal convenience within its own data permissions. Sources checked 2026-09-05; this is a selected design reference, not a claim of complete feature parity.
