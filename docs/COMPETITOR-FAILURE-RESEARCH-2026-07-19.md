# Competitor Failure Research: Dictation and Meeting Intelligence

**Status:** Dated architecture input; not a claim that every listed issue is still unresolved  
**Reviewed:** 2026-07-19  
**Products:** Wispr Flow, tl;dv, Fathom, and selected local-runtime evidence

## Scope and method

This review examines publicly accessible support articles, known-issue pages, release notes, status history, public issue trackers, and a small set of public customer reports. Private support queues and internal ticket systems are not accessible, so “all public tickets” means the relevant issue evidence that the vendors or users have made public.

Evidence is classified as follows:

- **Official support/status evidence:** confirms that a failure class has occurred or is important enough for the vendor to document. It does not reveal frequency.
- **Public customer report:** useful anecdotal evidence of user impact. It is not treated as proof of prevalence or root cause.
- **Open-source issue:** direct environment and reproduction evidence, but often unconfirmed and specific to one hardware/software combination.
- **Historical Ascend/donor evidence:** useful orientation only. Current specifications, tests, and official sources take precedence.

The purpose is not to score competitors. It is to turn recurring failure classes into Ascend contracts, recovery behavior, and tests before feature code depends on optimistic assumptions.

## Executive finding

Most severe failures are not caused by the headline AI model. They occur at boundaries:

1. operating-system audio, input, clipboard, focus, sleep, and process lifecycle;
2. local-to-cloud transitions, network policy, capacity, and retry behavior;
3. calendar authorization, meeting detection, bot admission, and consent;
4. long-running upload, processing, and synchronization state machines;
5. speaker identity, sharing defaults, and account/workspace ownership;
6. native/model runtime packaging, driver compatibility, memory pressure, and upgrades.

Ascend should therefore optimize for **recoverability, explicit state, provenance, isolation, and honest degradation**. “Use a better model” is not a sufficient reliability strategy.

## Public source set

### Wispr Flow

- [Microphone troubleshooting](https://docs.wisprflow.ai/articles/4351452717-troubleshooting-mic-issues)
- [Text not pasting after dictation](https://docs.wisprflow.ai/articles/7971211038-fix-text-not-pasting-after-dictation)
- [Quit and relaunch troubleshooting](https://docs.wisprflow.ai/articles/7492559320-quit-and-relaunch-wispr-flow)
- [Network, VPN, and security-tool failures](https://docs.wisprflow.ai/articles/3834764683-why-vpns-or-security-tools-can-block-wispr-flow)
- [Slow and failed transcription recovery](https://docs.wisprflow.ai/articles/4984532368-fix-taking-longer-than-usual-and-transcription-errors)
- [Supported devices and Windows microphone issues](https://docs.wisprflow.ai/articles/1036674442-supported-devices-and-system-requirements)
- [Known issues collection](https://docs.wisprflow.ai/collections/5686269587-known_issues)
- [Official status history](https://statuspage.incident.io/wispr-flow/history)
- [Reliability release notes](https://wisprflow.ai/whats-new)
- Anecdotal reports: [Windows clipboard mis-paste](https://www.reddit.com/r/WisprFlow/comments/1sp2qb8/wisprflow_clipboard_bug_on_windows_desktop/), [audio disruption on Windows](https://www.reddit.com/r/ProductivityApps/comments/1o0h99k/audio_stops_working_after_using_wispr_flow_for_a/), and [reliability/accuracy discussion](https://www.reddit.com/r/WisprFlow/comments/1tx06rk/reliability_and_accuracy_update_what_happened/)

### tl;dv

- [Bot did not join](https://intercom.help/tldv/en/articles/5946360-tl-dv-didn-t-join-my-meeting)
- [Calendar integration repair](https://intercom.help/tldv/en/articles/10256819-calendar-integration-and-why-it-matters)
- [Bot-free desktop capture](https://intercom.help/tldv/en/articles/14433337-recording-without-a-bot)
- [Recording processing delay](https://intercom.help/tldv/en/articles/8460994-my-video-transcript-is-still-processing)
- [Uploads and indefinitely stuck entries](https://intercom.help/tldv/en/articles/7266251-uploads)
- [Meeting library loading failures](https://intercom.help/tldv/en/articles/8461106-the-meeting-library-recording-do-not-load)
- [Consent collection behavior](https://intercom.help/tldv/en/articles/12109041-consent-collection)
- [Recording, sharing, and language preferences](https://intercom.help/tldv/en/articles/8925840-understanding-and-setting-your-preferences)
- [API alpha status and error behavior](https://intercom.help/tldv/en/articles/11583137-api)
- [Webhooks and readiness events](https://intercom.help/tldv/en/articles/15416775-webhooks)
- [Official service status](https://tldv.instatus.com/)

### Fathom

- [Google Meet detection troubleshooting](https://help.fathom.video/en/articles/449472)
- [Supported devices and meeting limitations](https://help.fathom.video/en/articles/296576)
- [Capture modes and bot-free rollout](https://help.fathom.video/en/articles/11577345)
- [Internal, external, and impromptu meetings](https://help.fathom.video/en/articles/294208)
- [Name Picker and user identity ambiguity](https://help.fathom.video/en/articles/297152)
- [Windows uninstall and remaining cloud automation](https://help.fathom.video/en/articles/295232)
- [Salesforce synchronization troubleshooting](https://help.fathom.video/en/articles/448640)
- [MCP connection troubleshooting](https://help.fathom.video/en/articles/11497793)
- [Official component status](https://status.fathom.video/)
- Anecdotal reports: [bot stuck in a waiting room](https://www.reddit.com/r/Zoom/comments/1m83h7w) and [calendar/account reconnection conflict](https://www.reddit.com/r/sysadmin/comments/1auntzy)

### Local-runtime evidence

- [llama.cpp supported hardware backends](https://github.com/ggml-org/llama.cpp)
- [llama.cpp public issue list](https://github.com/ggml-org/llama.cpp/issues)
- [Example Windows/Vulkan memory-accounting failure](https://github.com/ggml-org/llama.cpp/issues/18946)
- [Example Windows missing-runtime/DLL failure](https://github.com/ggml-org/llama.cpp/issues/19236)
- [whisper.cpp supported CPU/GPU paths](https://github.com/ggml-org/whisper.cpp/blob/master/README.md)

## Failure taxonomy and Ascend requirements

| Failure family                                         | Public evidence pattern                                                                                                                                                                                                | Requirement baked into Ascend                                                                                                                                                                                          | Required verification                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passive permission checks lie                          | Wispr documented false Windows microphone-privacy results and setup meters that did not represent live audio.                                                                                                          | A capability is never marked ready from enumeration or a global flag. Readiness requires a user-initiated functional test through the production adapter.                                                              | Denied, policy-blocked, no-device, busy-device, stale-evidence, and functional-readback tests.                                                           |
| Audio devices are dynamic                              | Public support material covers disconnected selected microphones, Bluetooth initialization, system-driver warmup, hardware mute, other-app ownership, and mid-session silence.                                         | Use opaque device IDs, live notifications, explicit pinned/default policy, capture health meters, and visible stop/degradation. Never silently substitute another physical microphone.                                 | Hot-plug, default change, duplicate names, Bluetooth delay, exclusive-use, Windows Audio restart, sleep/wake, and mid-stream silence tests.              |
| Cleanup races create stuck sessions                    | Wispr documented microphone-active-after-cancel, stuck Listening state, stale text from a previous session, and delayed restart after fast cancel/retry.                                                               | One serialized capture arbiter and one idempotent cleanup path own capture, suppression, session generation, and terminal state. A new session cannot start until the prior lease is terminal or explicitly recovered. | Cancel at every state transition, rapid press/release, retry during cleanup, process crash, and stale-event rejection tests.                             |
| Global hooks can damage the desktop                    | Wispr’s status history records a Windows mouse-unresponsiveness incident; public reports describe shortcut/input interference.                                                                                         | Global hotkeys and hooks are narrow, reversible, conflict-detected, and disabled independently. The renderer never installs privileged hooks.                                                                          | Keyboard-layout matrix, mouse-button conflict, secure desktop, lock screen, competing hook, and uninstall/restart restoration tests.                     |
| Clipboard/focus delivery is lossy                      | Wispr documents inactive text fields, old clipboard content, app-specific insertion failures, and manual-paste fallback; public reports describe intermittent wrong-content pastes.                                    | Transcription completion and text delivery are separate transactions. Revalidate focus, use a guarded clipboard swap, verify delivery where possible, preserve the transcript, and offer a manual recovery action.     | Focus change, clipboard contention, clipboard manager, non-QWERTY layout, elevated target, unsupported field, and previous-content restoration tests.    |
| Long speech is easy to lose                            | Wispr added recovery for dismissed/failed transcriptions and preserves retryable audio for some failures.                                                                                                              | Audio/text enters a recoverable operation journal before remote processing. A cloud or paste failure must not destroy the only copy. Retention follows the approved privacy/storage policy.                            | Network drop at each chunk, manual quit, force-kill, timeout, retry, cancel, corruption, and explicit-delete tests.                                      |
| Cloud capacity and vendors fail                        | Wispr’s official status/release notes document latency, backend instability, upstream-provider degradation, and added redundancy.                                                                                      | Cloud routes have timeouts, bounded retry, provider health, circuit breakers, a visible queue, and an explicitly configured local/cloud fallback policy. No hidden cloud switch or false “internet problem” message.   | Provider outage, regional degradation, partial response, retry exhaustion, local-only policy, cloud-only policy, and recovery tests.                     |
| Model changes regress quality                          | Wispr publicly described an accuracy regression associated with a cleanup setting and investigated rollback/model changes.                                                                                             | Every inference result records model, runtime, prompt/config, route, and version. Rollouts need frozen evaluation sets, canaries, rollback, and correction-rate monitoring without content telemetry.                  | Golden audio/text corpus, version A/B comparison, rollback, configuration interaction, language, jargon, and first-word tests.                           |
| Helper processes fail independently                    | Wispr documents Windows helper loading/retry, startup crashes, disconnection, and wake recovery.                                                                                                                       | Native and model workers are supervised, authenticated, health-checked, restart-bounded, and isolated from the database. A worker crash cannot crash the shell or corrupt trusted state.                               | Missing binary/DLL, bad version, delayed start, crash loop, wrong process on port, sleep/wake, shutdown, and orphan-process tests.                       |
| Network policy is not ordinary offline                 | VPNs, proxies, ad blockers, enterprise allowlists, and security products appear throughout Wispr and tl;dv troubleshooting.                                                                                            | Distinguish DNS/TLS/proxy/policy/provider/rate-limit/auth errors. Support diagnostics through content-free codes, not a generic connection error.                                                                      | VPN/proxy, TLS interception, blocked domain, captive portal, IPv4/IPv6, provider 401/403/429/5xx, and offline tests.                                     |
| Calendar authorization silently decays                 | tl;dv documents missing permissions and forced Google/Microsoft resync; Fathom depends on primary-calendar placement and link location.                                                                                | Calendar grants, selected calendars, sync cursors, last success, scope changes, and source-field assumptions are explicit. Stale data remains visibly stale.                                                           | Revocation, expired refresh, wrong account, sub-calendar, moved link, recurring event, deleted occurrence, time-zone, and resync tests.                  |
| Meeting detection is heuristic                         | Fathom and tl;dv document scheduled versus impromptu meetings, unsupported forms, provider-specific conditions, and fallback manual add/start flows.                                                                   | Detection produces a proposal with evidence, not silent recording. Manual start always remains available. Provider capability matrices are versioned.                                                                  | Early/late join, ad hoc call, duplicate links, overlapping events, recurring meetings, unsupported webinar/breakout, and false-positive tests.           |
| Cloud bots have admission state                        | tl;dv documents scheduled-time joins, waiting-room expiry, anonymous-guest restrictions, one-bot collisions, no-participant timeout, and maximum duration.                                                             | A future bot uses a durable state machine: scheduled, joining, waiting, admitted, capturing, stopping, processing, ready, degraded, failed, or cancelled. Every transition is visible and idempotent.                  | Waiting-room timeout, denied admission, host absent, duplicate bot, meeting not started, meeting overrun, network split, and cancel tests.               |
| Processing can remain non-terminal                     | tl;dv documents recordings taking up to two hours, bots remaining in calls, uploads stuck indefinitely, and failed entries without retry/delete.                                                                       | Capture, upload, transcription, summary, and integration are distinct durable jobs with deadlines, resumable inputs, cancellation, retry, quarantine, and operator/user recovery. No permanent anonymous “Loading.”    | Worker death, repeated cursor, partial upload, duplicate retry, poison input, deadline, cancellation, and cleanup tests.                                 |
| Speaker identity is uncertain                          | Fathom presents a Name Picker when it cannot match the user; tl;dv lacks speaker recognition for uploads.                                                                                                              | Diarization and identity resolution are separate. Preserve anonymous stable speaker IDs, attach typed evidence/confidence, and let the user correct mappings. Never guess a name merely to fill a field.               | Same names, changed display names, missing roster, upload, overlapping speech, 1:1 stems, multiple remote speakers, and correction/rebuild tests.        |
| Consent and sharing defaults surprise users            | tl;dv consent may modify calendar links and has recurring-event caveats; vendor settings can auto-record/share; public reports describe bot/admission surprises.                                                       | Personal and private by default. Capture, participant notice, sharing, follow-up email, calendar modification, and external write are separate permissions with previews and audit.                                    | Old/new recurring events, declined consent, missing calendar-write scope, auto-share off, private meeting, organization membership, and uninstall tests. |
| Local uninstall does not stop remote automation        | Fathom tells users to disable web settings separately after uninstall; tl;dv notes that desktop removal does not necessarily disable calendar-driven bots.                                                             | Disconnect, disable automation, revoke provider grant, delete local app, uninstall desktop, and delete account are distinct operations shown in one lifecycle view.                                                    | Uninstall with active automation, revoked token, offline uninstall, reinstall, device removal, and account deletion tests.                               |
| Provider integrations drift                            | Fathom’s CRM guide lists revoked tokens, attendee matching, relationship requirements, closed records, changed mappings, and provider validation rules; tl;dv’s API is alpha and its webhook payloads differ by event. | Validate every external schema, normalize into canonical records, version provider profiles, deny unknown capabilities, use idempotency, and preserve a contract-tested fallback.                                      | Missing/renamed fields, changed enum, wrong attendee, removed target field, duplicate webhook, out-of-order event, and fallback-equivalence tests.       |
| Hardware/runtime capacity is non-deterministic         | llama.cpp’s public tracker contains backend regressions, missing artifacts, OOM, driver-specific crashes, and bad output on some GPU paths.                                                                            | Select local runtimes through functional probes and bounded benchmarks, not model-size marketing or GPU brand alone. Isolate workers, budget RAM/VRAM, keep rollback, and fail visibly.                                | CPU/GPU/NPU variants, multi-GPU, low disk/RAM/VRAM, driver upgrade, bad backend, worker OOM, sustained load, and CPU fallback tests.                     |
| Diagnostics can leak the product’s most sensitive data | Competitor support often asks for logs, console output, recording links, or account details.                                                                                                                           | Default logs are local, content-free, and allowlisted. Any support bundle is user-reviewed, explicitly exported, scoped, and redacted. Audio, transcript, prompts, health data, voiceprints, and tokens are excluded.  | Secret-shaped values, transcript/audio fixtures, path/user-name redaction, support-bundle preview, and opt-out tests.                                    |

## Cross-cutting architecture consequences

### 1. State machines before happy-path APIs

Capture, dictation, model loading, cloud processing, calendar sync, bot admission, upload, and provider writes require explicit durable states. A boolean such as `isRecording`, `isConnected`, or `isLoading` cannot represent partial success, recovery, stale state, or ownership.

### 2. Every operation keeps provenance

User-visible results must retain the capture source, input asset, processing route, provider/runtime, model and configuration version, start/end time, gaps, degradation, and correction lineage. Provenance enables replay, rollback, explanation, and support without guessing.

### 3. Failure is a product state

Stable reason codes should distinguish action required, policy blocked, unsupported, unavailable, degraded, retryable, and terminal failure. Raw provider or native error strings remain diagnostic data inside their boundary.

### 4. Local and cloud are peers, not hidden fallbacks

The same domain capability may have local and cloud implementations, but the user’s data-locality policy governs routing. If the user selects local-only, Ascend never sends the input to a cloud service. If automatic fallback is later offered, it must be explicitly configured and visible in the execution receipt.

### 5. Internal extension contracts first; arbitrary plugins later

“Plug-and-play” means a new approved adapter can satisfy a narrow, versioned contract and pass the same conformance suite. It does not mean loading arbitrary Python packages, DLLs, MCP tools, model code, or third-party UI into the trusted engine.

### 6. The taxonomy becomes a maintained regression corpus

Each production feature specification must select the relevant rows from this document and turn them into:

- fake-adapter contract tests;
- deterministic state-machine tests;
- fault-injection tests;
- supported Windows hardware/provider matrices;
- clean install/update/uninstall checks;
- content-free diagnostic events;
- user-facing recovery copy.

## Limits of this research

- Help-center content changes and may describe fixed historical bugs.
- Status pages are vendor-reported and may not include every customer-visible degradation.
- Public customer reports are anecdotes, sometimes missing reproducible details.
- Search engines do not expose every public page equally.
- No private ticket frequency, severity distribution, or vendor root-cause data was available.

The architecture therefore adopts **failure classes**, not unverified frequency claims or competitor-specific implementation guesses.
