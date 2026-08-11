# ADR-0005: Agent OS, skill, tool, and external-AI boundaries

## Status

Proposed on 2026-07-19 under OD-19. No agent runtime, skill loader, provider dependency, external-agent integration, credential, cloud resource, autonomous execution, or browser automation is approved by this proposed ADR.

## Context

Ascend's long-term direction is larger than a productivity dashboard or a provider-specific chatbot. It may become the user's trusted personal agent, coordinate work through reusable skills and tools, use OpenAI, Anthropic, and future local models, expose approved Ascend capabilities to external AI clients, and later support team and organization agent workflows.

Current products use overlapping words for different concepts. A skill can mean reusable instructions, a connector can expose tools, an agent can be a model configuration or a durable worker, and an MCP server can advertise operations broader than the product intends to permit. Treating these as equivalent would let prompt content or provider metadata accidentally become authority.

Directly controlling consumer ChatGPT or Claude interfaces through browser automation, session cookies, or private endpoints would also create a brittle credential and audit boundary. Conversely, coupling Ascend to only one model provider would undermine the single-interface goal and future local execution.

Building a complete agent framework during Milestone 0 would be speculative. The project needs durable architectural distinctions now, then the minimum concrete contracts alongside an approved vertical slice.

## Decision

Adopt Ascend as the trusted Agent OS layer with these boundaries:

- Ascend owns identity, tenant/workspace scope, memory, context disclosure, permissions, policy, approvals, durable run state, tool execution, verification, and audit.
- Model providers and external-agent providers are replaceable inference or execution capabilities. They never own Ascend authorization or credentials for unrelated systems.
- A skill is a versioned, reviewable instruction/resource bundle. It can declare required capabilities but cannot grant permissions, receive raw credentials, or expand its authority.
- A tool is one typed operation. Every execution passes through a code-enforced gateway that validates schema, actor, workspace, data class, connector grant, risk, target, arguments, idempotency, and result.
- A connector supplies authenticated transport through MCP or an official API. Provider-advertised tools never broaden Ascend's local allowlist.
- A workflow is an approved graph of steps and checkpoints. A trigger can propose a run but grants no authority.
- A run is durable, bounded, cancellable, resumable, and auditable. Side-effecting steps use idempotency and reconciliation so retries or restarts do not duplicate actions.
- Human approval is bound to the exact actor, run, tool, target, arguments/diff, disclosure, policy, risk, cost, and expiry. Material changes invalidate approval.
- Personal, workspace, and organization-owned agents, skills, runs, schedules, memory, and grants have explicit ownership and are private by default.
- Use one responsible coordinator first. Add bounded specialist agents as tools only when specialization or isolation justifies the complexity; handoffs and parallel agent trees require separate proof.
- Support three separable external-AI directions: Ascend using provider model APIs, approved external clients using Ascend MCP/API tools, and Ascend invoking documented external-agent APIs where supported.
- Browser/UI automation, consumer-session cookies, reverse-engineered endpoints, and control of arbitrary existing ChatGPT or Claude chats are not foundational integration routes.
- Do not build speculative agent/skill/run tables or runtime infrastructure during Milestone 0. Add only the minimum contracts and persistence with the first separately approved agentic vertical slice.

## Alternatives considered

### Let each model provider own its own tools, memory, and workflow

- Advantage: less Ascend infrastructure initially.
- Rejected: authorization, retention, audit, portability, local models, organization boundaries, and recovery would vary by provider and fragment the user's source of truth.

### Treat skills as plugins with their requested permissions

- Advantage: fast ecosystem growth.
- Rejected: downloaded instructions or code would become a supply-chain path to credentials, data, tools, and device authority. Skill content and authority must remain separate.

### Parse model prose and execute inferred actions

- Advantage: flexible demos.
- Rejected: free-form text is ambiguous and prompt-injectable. Privileged operations require typed schemas, deterministic policy, preview, idempotency, verification, and audit.

### Depend on browser automation to control ChatGPT and Claude

- Advantage: may appear to unify existing consumer sessions quickly.
- Rejected: UI drift, credential exposure, wrong-target actions, weak idempotency, uncertain terms, and poor auditability make it unsuitable as a foundation. Official APIs and MCP boundaries remain replaceable routes.

### Build a multi-agent swarm first

- Advantage: broad demonstration capability.
- Rejected: delegation loops, cost, conflicting writes, partial failure, context leakage, and unclear responsibility add risk before one bounded coordinator is proven.

### Defer every agent concept until implementation

- Advantage: less documentation now.
- Rejected: early model, connector, memory, and task interfaces would otherwise conflate instructions, authority, and execution, making later safety and provider neutrality expensive to retrofit.

## Consequences

- The user can receive one coherent Ascend experience while models and execution providers remain replaceable.
- Skills can be shared and versioned without becoming permission-bearing plugins.
- Agentic actions require more application-owned policy, persistence, verification, and testing than a simple chat wrapper.
- Durable runs and idempotency add complexity but prevent duplicate or unauditable external actions.
- Organization catalogs and policy can be added later without exposing personal skills, memory, or run history by default.
- Official provider surfaces can evolve without making consumer UI automation part of the trusted core.
- Milestone 0 remains focused; acceptance of this ADR adds no runtime, table, dependency, credential, provider account, or feature.

## Required follow-up before acceptance

- Founder approval of `docs/AGENT-OS-AND-SKILLS-ARCHITECTURE-PROPOSAL.md` and OD-19.
- Confirm that migration 0001 does not pre-build speculative agent tables.
- Select a separately approved read-only agentic vertical slice after Milestone 0 and applicable integration gates.
- Re-verify official provider APIs, MCP behavior, retention, pricing, and external-agent surfaces at implementation time.
- Specify exact contracts, persistence, risk tiers, approval UX, data disclosures, evaluations, and recovery before production behavior.
