# ADR-0004: Capability-oriented modular runtime boundaries

## Status

Proposed on 2026-07-19 under OD-18 and amended on 2026-08-04 to preserve OD-20's future local visual-context seam. No screenshot capture/storage, runtime, dependency, model, cloud service, or implementation is approved by this proposed ADR.

## Context

Ascend’s v1 work product already needs transcription, AI writing, capture, memory, and external-provider adapters. The long-term product may add local transcription models such as NVIDIA Parakeet-family candidates, local language-model runtimes such as llama.cpp-family candidates, CPU/GPU/NPU execution, opt-in retained screenshots analyzed by a local vision/OCR worker, a cloud meeting bot, speaker identity, and optional health/wellness modules.

Implementing each future feature directly inside the Python engine would couple domain behavior to model packages, native libraries, GPU drivers, cloud providers, and hardware assumptions. A failure or dependency conflict in one runtime could destabilize the engine that owns trusted state and SQLite.

Loading arbitrary plugins would create a larger problem: dynamically obtained code could inherit database, credential, filesystem, MCP, and user-data authority before Ascend has a sandbox and permission model.

Building a complete extension framework now would also be speculative. V1 does not yet have a production model adapter, and premature abstractions can be as expensive as direct coupling.

## Decision

Adopt a capability-oriented modular architecture:

- Domain modules own product meaning, authorization, data classification, and user-visible policy.
- Versioned capability contracts separate domain code from cloud providers, local runtimes, hardware backends, and meeting capture sources.
- Provider/runtime adapters validate inputs and outputs at their boundary and return one structured result plus an execution receipt.
- Dependency-heavy, native, model, and driver-sensitive runtimes run in supervised isolated workers without direct database, credential-store, filesystem, MCP, or unrelated workspace access.
- Local/cloud routing follows an explicit user data-locality policy and is never a hidden fallback.
- Model/runtime artifacts are pinned, verified, licensed, resource-bounded, rollback-capable supply-chain inputs.
- A resource governor arbitrates CPU, RAM, disk, GPU/NPU, battery, thermal, queue, and concurrency constraints; real-time capture outranks background inference.
- Future visual context distinguishes accessibility metadata, transient frames, retained screenshots, and derived visual observations. Retained screenshots are encrypted local-only personal assets, off by default, and processed through an isolated network-denied local vision/OCR worker with no direct trusted-state access.
- Raw screenshots and derived visual observations have separate data classifications, provenance, retention, deletion, and disclosure policy. They are denied from organization access, general API/MCP/export, diagnostics, and unrelated AI context by default.
- The canonical meeting model remains capture-source neutral. Local bot-free capture, a future cloud bot, provider artifacts, and imports retain distinct provenance.
- Diarization and speaker identity remain separate. Unknown speakers stay unknown; identity uses typed evidence, confidence, and durable user correction.
- Health, wellbeing, voice-profile, and spiritual-reflection data use separate deny-by-default data classifications and never inherit work, organization, API, MCP, search, export, or diagnostic access.
- Initially only reviewed built-in modules and adapters are allowed. An external plugin ecosystem requires a separate ADR and security specification.
- Concrete contracts and workers are implemented alongside the first relevant approved vertical slice, not as speculative production infrastructure during Milestone 0.

## Alternatives considered

### Add each provider/runtime directly to the engine

- Advantage: fastest first integration.
- Rejected: couples product behavior to volatile SDKs, dependency graphs, GPU drivers, and model formats; increases crash and upgrade blast radius.

### Use one universal local model server for every task

- Advantage: one process and API.
- Rejected: ASR, LLM, diarization, embedding, and future health inference have different model formats, latency, streaming, resource, license, and isolation requirements. One server would become an accidental privileged monolith.

### Load arbitrary third-party plugins now

- Advantage: fastest ecosystem growth.
- Rejected: there is no approved signing, sandbox, permission, update, revocation, storage, UI, or incident-response model. Arbitrary plugins would inherit unacceptable authority.

### Build every future module and table now

- Advantage: appears to maximize future readiness.
- Rejected: health, bot, biometric, and organization requirements are not yet specific enough. Premature schemas and empty framework code create migration burden without proven value.

### Keep future features entirely unspecified

- Advantage: minimum immediate design effort.
- Rejected: direct provider/runtime assumptions would leak into early contracts and make later isolation, privacy separation, and capture-source neutrality expensive to retrofit.

## Consequences

- Early domain interfaces carry explicit capability, provenance, data-class, tenant, workspace, and failure semantics.
- Concrete model/runtime selection remains separately researched and approved.
- Local workers add supervision and IPC complexity, but limit dependency and crash blast radius.
- Model distribution, hardware support, and fallback behavior require explicit product decisions rather than hidden runtime behavior.
- A new adapter must pass a common conformance and fault-injection suite.
- V1 remains focused; no retained screenshot path, local vision model, local LLM, Parakeet integration, meeting bot, speaker biometric, or health module is added merely by accepting the architecture.
- Future personal wellness modules can share identity and capability infrastructure without becoming work or organization data.

## Required follow-up before acceptance

- Founder approval of `docs/FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL.md` and OD-18.
- Review that migration 0001 preserves seams without pre-building future feature tables.
- Exact capability contracts, reason-code vocabulary, and worker IPC in a separately approved first-feature specification.
- Current source, version, license, security, packaging, and hardware proof before adding any runtime or model.
- A separate approved visual-context specification before screenshot capture or retention, covering capture visibility, target/exclusion policy, encryption, cadence, storage quota, retention/deletion, local-only enforcement, model/runtime selection, and residual secret-capture risk.
