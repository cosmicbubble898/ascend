# Proposal: Windows Hardware and Permission Baseline

**Status:** Approved by the founder on 2026-07-19; no native implementation or dependency is authorized by this approval
**Prepared:** 2026-07-19
**Scope:** Windows 11 x64 individual v1; organization-ready device ownership seams

## Purpose

Ascend must feel dependable on real Windows computers, not only on a developer laptop. A user may have one to five or more displays, several microphones, several speaker or headset endpoints, docks, HDMI audio, Bluetooth devices, and hardware that appears or disappears while Ascend is running.

This proposal defines the product contract before implementation. It covers device discovery, hot-plug behavior, multi-display placement, first-run capability checks, and the rule that playback is silenced while dictation captures speech and restored safely when capture stops.

The baseline is intentionally separate from transcription, meeting capture, and productivity tracking. Those features consume this contract instead of implementing their own device logic. One engine-owned hardware arbiter coordinates dictation, microphone tests, meeting capture, and future system-audio/screen capture so independent features cannot race the same devices or restoration state.

## Founder requirements recorded

1. Ascend is Windows-first.
2. It must work with one, three, four, five, or more connected monitors without assuming that the primary monitor is the only workspace.
3. It must discover and support multiple microphones and multiple speaker/output devices.
4. When dictation starts, speaker output should become silent. When dictation stops, the previous output state should return.
5. Initial setup must explain and verify the permissions or capabilities Ascend needs and show what is ready, blocked, unavailable, or degraded.
6. Devices added, removed, disabled, made default, docked, or reconnected later must be handled without restarting or corrupting stored preferences.
7. No failure may be hidden behind a false success message. The user must know which device is active and whether capture and output suppression actually succeeded.

## Product principles

### 1. Capability-specific consent, never blanket access

Windows does not provide one permission that lets Ascend “inspect the laptop,” and Ascend must not ask for vague access to everything. It requests or tests only the capability needed for a feature, at the moment the user understands why it is needed.

The first-run Capability Center reports:

- Microphone capture
- Speaker/output control
- Global shortcut registration
- Display topology and overlay placement
- Meeting system-audio capture, when that feature is separately approved
- Screen-context capture, when that feature is separately approved

Each row uses one typed state: `not_checked`, `ready`, `action_required`, `blocked_by_policy`, `unavailable`, or `degraded`. A state includes a human explanation, the affected device or feature, a safe retry action, and an optional Windows Settings link. It never includes captured content.

Passive onboarding may enumerate and inspect capability metadata, but it never records audio or changes mute state. Any microphone or output-control test requires a clearly labeled user action and the applicable real-data gate.

Enumeration or Electron's global media-access status is metadata evidence only and cannot produce `ready`. A capability becomes `ready` only after the same production adapter successfully completes a user-initiated functional test or real approved use against the selected device and verifies its result. Software-only mute with an unproven exclusive path is `degraded`, not `ready` for guaranteed silence. Device/topology generation changes, permission or policy changes, Windows Audio restart, adapter restart, or stale evidence returns the affected capability to `not_checked` or the exact blocked/degraded state.

Classic Windows desktop applications do not receive a macOS-style prompt for every capability. Microphone access can be disabled globally for desktop apps or forced by organization policy. Display and audio-endpoint enumeration have no equivalent user-consent dialog. Ascend therefore performs a transparent capability check and links to the relevant Windows settings when the user must act; it never claims that it granted permission itself.

### 2. Stable device identity

Audio devices are keyed by the opaque Windows endpoint ID, never by list position or friendly name. Friendly names are display labels only because two identical USB microphones can have the same name.

The stored preference is one of:

- `system_default` plus a Windows role (`console`, `multimedia`, or `communications`); or
- a pinned opaque endpoint ID.

`system_default` is resolved again immediately before use. A pinned endpoint that is unavailable remains visible as “Selected device unavailable” rather than silently becoming another device.

Every device snapshot distinguishes capture and render direction, state (`active`, `disabled`, `not_present`, or `unplugged`), default roles, friendly label, and last observed time. Endpoint IDs are treated as opaque and are never parsed.

### 3. Device changes are normal events

A serialized Windows audio service subscribes to endpoint-added, endpoint-removed, state-changed, property-changed, and default-device-changed notifications. Native callbacks enqueue small typed events and never block, re-register callbacks, or perform product work inside the Windows callback.

Topology notification registration is persistent before any capture transaction. For each render endpoint, Ascend registers its volume callback before reading the original mute state so a user or hardware change cannot occur in an unobserved snapshot gap. All notification, snapshot, lease, mutation, read-back, and restoration work is serialized.

The engine owns the policy response. The Windows adapter owns enumeration and endpoint operations. The renderer never receives raw COM objects, native pointers, or unrestricted device control.

If a pinned microphone disappears during dictation, Ascend stops capture safely, restores speaker state, preserves the captured words/audio already held by the approved pipeline, and presents a device-specific recovery action. It does not silently switch to another physical microphone.

`system_default` is resolved once at capture start. A healthy open microphone remains fixed for that capture even if Windows changes the default role; the new default is used on the next capture. If the open endpoint becomes unavailable, Ascend stops and reports the device loss rather than silently switching. After a Windows Audio service restart, the adapter re-enumerates endpoints, re-registers notifications, fails any active capture visibly, restores output where possible, and requires a new user start.

### 4. One hardware arbiter across features

The Python engine owns one `HardwareCaptureArbiter`. Every operation obtains a typed, cancellable lease before opening a microphone, starting system-audio capture, testing a device, or suppressing output. A lease identifies the actor/device context, feature (`dictation`, `microphone_test`, `meeting_capture`, or future approved capture), requested endpoints, output-suppression policy, and controller session.

The initial safe coexistence policy is exclusive:

- A microphone test cannot start while dictation or meeting capture owns audio.
- Meeting capture cannot start while dictation or a microphone test owns audio.
- Dictation cannot start while meeting capture owns microphone or system audio because output suppression could silence the meeting or invalidate its loopback track.
- A second start from the same feature is idempotent; a competing feature receives a visible `hardware_busy` result naming the active feature and its safe stop/pause action.
- No renderer can bypass the arbiter or call native device control directly.

Later simultaneous capture or stream fan-out requires its own approved behavior, echo/loopback evidence, and arbiter-policy update. It is not inferred from hardware being technically openable by two clients.

### 5. Multi-display topology is dynamic

The Electron main process owns a `DisplayTopologyService`. After Electron is ready, it snapshots every display and listens for display-added, display-removed, and display-metrics-changed events. A snapshot includes an ephemeral topology key, the Electron display ID as an optional current-topology hint, label, internal/external indication where available, bounds, work area, scale factor, and rotation. Electron IDs `-1` (invalid/unknown) and `-10` (unified virtual display) are never used as unique keys.

All normal Electron window and overlay geometry remains in device-independent pixels. Coordinates may be negative because a monitor can sit above or to the left of the primary display. Ascend must not multiply Electron geometry by the display scale factor itself.

At dictation start, the indicator appears inside the work area of the display containing the focused target application's window. If the target bounds cannot be resolved safely, Ascend falls back to the display nearest the pointer and then to the primary display. It remains stable during the dictation unless its display disappears. If that display is removed, the indicator moves to the best remaining display and visibly reports the topology change.

Saved windows use normal, non-maximized bounds. On restore, Ascend matches those bounds against the current topology, clamps the window inside a current work area, and falls back to the primary display when the old monitor no longer exists. Display IDs are current-topology hints only and are never assumed permanent across reboots or topology changes.

## Dictation output-suppression contract

### Why mute rather than set volume to zero

Ascend uses the Windows endpoint mute control for render endpoints. It does not overwrite the user's master volume scalar. Muting provides silence while preserving the user's chosen volume level for restoration.

Session-level mute is insufficient because it affects only one application. The product requirement covers playback from other applications, so the baseline targets active render endpoints.

### Default scope

With **Silence playback during dictation** enabled, Ascend targets every currently active Windows render endpoint. This includes speakers, headsets, docks, Bluetooth outputs, and HDMI/DisplayPort monitor audio. A future advanced setting may narrow the scope to selected outputs, but the default promise is not satisfied by muting only today's default device.

If a new render endpoint becomes active during dictation, Windows may allow a short interval before its notification reaches Ascend. Ascend therefore moves capture to a visible paused/degraded state as soon as it receives the event, records a capture gap, snapshots the endpoint, atomically extends the recovery lease, mutes it, and reads the state back before resuming. If suppression cannot be confirmed, capture remains paused until the user retries, cancels, or explicitly continues without suppression. Ascend does not claim that software can prevent every pre-notification sound on every driver. An endpoint that disappears is retained in the transaction so reconnect behavior is explicit.

### Start state machine

Only one arbiter-approved dictation start/stop transaction may own audio state at a time.

```text
idle
  -> starting: acquire the hardware arbiter; drain and reconcile the current topology generation
  -> observing: register per-endpoint volume callbacks, then snapshot original mute states
  -> silencing: durably journal intent, mute with Ascend's event context, read state back
  -> reconcile: process queued device events and confirm the topology generation is complete
  -> capturing: open the selected microphone only after required mute confirmation
```

Opening the microphone before confirming suppression is prohibited because speaker audio could enter the beginning of the dictation.

If any required output cannot be confirmed muted, Ascend rolls back every change it owns and enters a visible `suppression_blocked` state. The user may retry, cancel, or explicitly choose **Continue this dictation without silencing playback**. Ascend never silently continues and never displays “speakers muted” from an unverified call.

The visible recording indicator appears during `starting`, changes to the capture state only after the microphone is open, and reports partial/degraded state explicitly. A start sound, if enabled, plays before suppression; the persistent visual indicator remains authoritative.

### Ownership and user changes

For each target endpoint, Ascend records:

- Opaque endpoint ID
- Original mute state
- Whether Ascend changed the state
- Observable restoration ownership based on the lease and received callbacks
- Dictation/session ID
- A unique Windows event-context identifier

Windows volume callbacks include the event-context identifier. Ascend uses it to distinguish its own mute operation from a user, hardware key, Windows, or another application changing the endpoint.

If an external mute-state change is observed during dictation, Ascend does not fight the user. It relinquishes mute-restoration ownership for that endpoint and shows that playback suppression changed. A volume-only change does not transfer mute ownership and is never reverted because Ascend changes only mute state.

An endpoint that was already muted is never unmuted by Ascend.

### Stop and failure restoration

Every stop path uses one idempotent cleanup operation:

```text
capturing
  -> stopping microphone capture
  -> restoring each endpoint still owned by Ascend
  -> clearing the recovery lease only after verified restoration
  -> idle
```

Normal stop, cancel, microphone failure, transcription failure, hotkey error, indicator/main/renderer failure, engine shutdown, workstation lock, user switch, RDP disconnect, sleep, Windows end-session/logoff/shutdown/restart, and application Quit must converge on this operation. Audio restoration does not wait for transcription or text transformation.

The persistent recording indicator is a safety control. If it cannot be created or made visible, microphone capture does not start. If indicator ownership or visibility is lost during capture and cannot be re-established immediately, Ascend stops capture, restores outputs, and records an indicator-gap failure rather than continuing invisibly.

Electron cannot make a window visible on every Windows virtual desktop. Before and during capture, Ascend must prove that the indicator is on the active virtual/input desktop and not hidden or cloaked; otherwise it stops or blocks capture. Exclusive-fullscreen and secure-desktop behavior must be proven on Windows. Ascend never promises an overlay above the Windows secure desktop and never continues capture there merely because the process is still alive.

Before restoring an endpoint, the serialized helper drains queued callbacks and reads mute state again immediately before the restore call. It then restores only an endpoint where:

1. It changed an originally unmuted endpoint to muted.
2. No external mute-state conflict was observed after its change.
3. The endpoint is still muted at restoration time.

If the endpoint is unavailable, the unresolved lease remains bounded and visible for retry when the endpoint returns. Ascend does not delete evidence and claim success.

Core Audio does not provide compare-and-set or a durable ownership token. A same-value external mute request can produce no state-change callback, and a user/hardware action can race the final read followed by `SetMute(FALSE)`. Ascend cannot prove intent in those windows. It minimizes them through serialization, callback draining, event-context tagging, immediate read-before-write, post-restore read-back/verification, and continued callback observation; it never reverses a later observed user change. This residual limitation is tested and disclosed rather than covered by an absolute “never un-mutes incorrectly” claim.

### Crash recovery

The unelevated native audio helper is the sole mute mutator and recovery-journal owner. Before the first mute and before mutating each newly discovered endpoint, it writes a small versioned lease durably. The lease is bound to one installation, Windows user, application instance, controller session, and boot session. Each endpoint records original mute state, ownership, last verified state, and phase (`intent`, `applied`, `restoring`, `restored`, or `uncertain`).

Durable update means writing a replacement file, flushing it with Windows-supported write-through semantics, replacing the prior version atomically, and treating any ambiguous or failed write as a reason not to mutate the endpoint. The helper writes `intent` before `SetMute`, calls mute, reads state back, and then writes `applied`. A crash between intent and verified applied is `uncertain` and requires user confirmation; it is never guessed. The helper watches its authenticated controller and attempts restoration if the live controller exits unexpectedly. Normal process ordering gives the helper time to restore before it exits.

Only one Ascend instance may own a hardware lease. The helper accepts a narrow authenticated local command protocol, rejects a second controller, exposes no general device-control surface, and stores the lease in a per-user local path with restrictive access. The exact IPC, path, ACL, process-lifetime, and native toolchain design requires a reviewed ADR before implementation.

A hard machine crash or forced helper termination can still leave an endpoint muted. Windows shutdown/restart/logout does not reliably emit Electron's normal quit events, so the native boundary must also handle Windows end-session and terminal-session notifications with a bounded restoration attempt. If Windows ends the process before verification, the durable lease remains truthful.

Continuous helper observation may restore automatically when a live controller dies, but callback continuity and ownership proof are lost across a cold start or different boot/session. On the next launch, Ascend always presents any stale or uncertain lease for user-confirmed restoration; it never blindly un-mutes an endpoint based only on an old lease and current mute value.

The lease contains device IDs and state only. It contains no audio, transcript, window title, or user content and is never sent remotely.

### Honest Windows limitation

Windows endpoint software mute may not silence an exclusive-mode stream when the hardware has no physical mute support. A successful `SetMute` plus `GetMute` read-back proves only that the endpoint mute control is set; it does not prove physical silence.

Each endpoint result therefore distinguishes `mute_control_verified`, `hardware_mute_supported`, `exclusive_path_unproven`, and `failed`. Normal shared-mode suppression may proceed after verified mute control, but an unproven exclusive path is visibly labeled `suppression_limited` and never produces unconditional “speakers silent” wording. Ascend must query and test available support, record a local capability result, and avoid claiming guaranteed silence on an unproven path. This limitation requires real-hardware evidence before release wording is approved.

## User experience baseline

### First run

1. Explain that Ascend is local and requests capabilities feature by feature.
2. Show detected displays, microphones, and outputs without recording anything.
3. Let the user select `system_default` or a specific microphone.
4. Let the user choose whether playback suppression is enabled; default is enabled.
5. Run an explicit microphone test only after the user presses **Test microphone** and the real-data/encryption gate permits it.
6. Confirm the global shortcut is available or guide the user to rebind it.
7. Show a final readiness summary with exact blocked and degraded capabilities.

### Device settings

- Separate **Microphone** and **Playback outputs** sections
- Friendly label plus default role and connection state
- Refresh driven by Windows notifications, with a manual retry
- Live input meter only during an explicit test or capture
- Clear selected-device-missing state
- Per-feature explanation of why a capability is needed
- Direct Windows Settings action when the OS or administrator blocks microphone access
- No “permission granted” wording based only on device enumeration

### Runtime feedback

The dictation indicator distinguishes at least: `starting`, `capturing`, `stopping`, `device_missing`, `permission_blocked`, `suppression_blocked`, `suppression_limited`, `suppression_changed`, and `recovery_required`.

Errors name the affected device and safe next action. Local diagnostics use allowlisted codes and timings only; they never log audio, dictated text, window content, or raw device-property blobs.

The shortcut receives immediate visual acknowledgement while native work continues off the UI thread. Device enumeration, mute confirmation, capture open, stop, and restoration all have bounded timeouts and cancellation. The hardware matrix records median and tail start/restore latency; launch budgets are set from that evidence rather than hidden by animation or optimistic status text.

## Typed boundaries

The implementation must define provider-neutral contracts before a Windows adapter:

- `AudioDeviceSnapshot`
- `AudioTopologyEvent`
- `MicrophonePreference`
- `OutputSuppressionPolicy`
- `OutputSuppressionLease`
- `OutputSuppressionResult`
- `HardwareCaptureLease`
- `HardwareBusyResult`
- `CapabilityStatus`
- `DisplaySnapshot`
- `DisplayTopologyEvent`
- `DictationHardwareState`

Every native result is validated at the engine boundary. Unknown device states, callback variants, schema versions, or HRESULT mappings fail visibly and do not become success.

The renderer receives only minimal display-ready view models and allowed commands. Device enumeration, mute control, recovery leases, and Windows Settings launching are privileged operations with sender validation and narrow IPC.

## Privacy and organization readiness

- Hardware preferences belong to an actor and device inside a tenant/workspace context when the data foundation exists.
- Personal microphone and display choices never become organization-visible by default.
- A future organization policy may recommend settings but cannot silently enable capture or expose private device activity.
- Hardware inventory stays local unless a separately approved, explicit support export is created.
- Remote telemetry remains off by default.
- No actual microphone audio may be persisted under the current synthetic-only storage posture. Physical capture testing remains gated by the approved encryption and real-data rules.

## Required tests before production acceptance

### Deterministic automated tests

- One, two, three, four, five, six, and synthetic twelve-display layouts
- Negative display coordinates and monitors above the primary display
- Mixed 100%, 125%, 150%, and 200% scaling
- Primary display changes, rotation, taskbar/work-area changes, docking, and display removal
- Invalid/unknown (`-1`), unified virtual (`-10`), remote, and headless/fake display identities
- Focused target window and pointer/primary fallback placement
- Saved window bounds from a missing monitor
- Duplicate microphone friendly names with different opaque IDs
- Two or more simultaneously connected microphones with pinned/default selection changes
- `system_default` versus pinned-device behavior
- Active, disabled, unplugged, not-present, added, and removed endpoints
- Default-role changes and repeated/duplicate notifications
- Default-microphone changes during a healthy capture remain fixed until the next capture
- Windows Audio restart re-enumerates and re-registers but does not silently resume capture
- Dictation, microphone-test, meeting-capture, and future system-audio lease conflicts
- Start/stop idempotency and concurrent hotkey presses
- Device, topology, or volume event injected between every start/stop transaction step
- Already-muted endpoints
- Partial mute failure and read-back mismatch
- Verified mute-control state versus hardware-supported or exclusive-path-unproven silence
- User or hardware mute change during dictation
- Volume-only callback during dictation preserves the user's new volume and retains safe mute-restoration ownership
- Mute callbacks immediately before, during, and after restoration
- Same-value external mute intent is treated as an explicit unobservable Windows limitation
- New output appearing during dictation
- New-output mute/read-back failure keeps capture visibly paused until an explicit decision
- Microphone removal during dictation
- Stop, cancel, exception, engine crash, shell shutdown, sleep/resume, and startup recovery
- Main/renderer/indicator failure, workstation lock, user switch, RDP disconnect, logoff, shutdown, and restart cleanup
- Windows virtual-desktop switch, cloaked/hidden indicator, exclusive fullscreen, and secure-desktop entry
- Unavailable endpoint during restore followed by reconnection
- Corrupt, stale, future-version, partially written, unflushed, and replace-failed recovery lease
- Permission denied, enterprise-policy blocked, device busy, unsupported format, and no-device states
- Unknown native result/schema values fail closed

### Windows hardware matrix

After the relevant real-data, dependency, and packaging gates permit it, document tests across:

- Built-in, USB, Bluetooth, and dock microphones, including two or more connected simultaneously
- Built-in speakers, wired/Bluetooth headsets, USB audio, HDMI/DisplayPort monitor audio, and docks, including multiple active/routed outputs at once
- Duplicate-model USB microphones
- Shared-mode and observable exclusive-mode playback
- Device add/remove, default switches, Bluetooth profile switches, dock/undock, sleep/resume, and Windows Audio restart
- One through six displays plus a higher-count synthetic topology, mixed DPI, different taskbar positions, RDP, and virtual displays
- Word, common browsers, and chat applications for dictation focus and indicator placement

Every matrix run records OS build, hardware/driver identifiers appropriate for local diagnostics, scenario result, recovery behavior, and unresolved limitation. It uses synthetic phrases and approved test accounts/data only.

## Implementation sequence and gates

1. **Approve this product contract.** No native behavior begins before approval.
2. **Complete the currently gated Milestone 0 sequence.** The installer cleanup and data/process foundations remain blocking under the approved plan.
3. **Contract slice:** Build pure state machines and fake adapters with behavioral tests; no new dependency or real capture.
4. **Display slice:** Build the Electron main-process topology service and mixed-layout tests using the already approved Electron runtime.
5. **Native adapter proposal:** Select and approve the smallest supported Windows implementation/toolchain for Core Audio enumeration, notifications, endpoint mute, microphone capture, and crash recovery. Donor dependencies are not adopted automatically.
6. **Audio topology slice:** Implement enumeration, opaque identity, default roles, device notifications, and typed engine boundary.
7. **Suppression slice:** Implement the verified mute lease, external-change ownership, restoration, and crash recovery.
8. **Permission/device UX slice:** Implement the Capability Center, microphone selection, settings links, and truthful failure states.
9. **Hardware proof:** Execute the approved physical-device matrix before production feature code depends on the baseline.

Each production slice follows behavioral TDD, focused Windows runtime verification, the full quality gate, and code-quality/security review. New dependencies, a native build toolchain, actual microphone capture, real user data, signing spend, or distribution retain their existing approval gates.

## Donor evidence and disposition

The strongest historical references are:

- `C:\Users\samar\lpa-v1\engine\audio\muter.py` and `tests\test_muter.py`
- `C:\Users\samar\lpa-v1\engine\audio\mic.py` and `tests\test_mic.py`
- `C:\Users\samar\lpa-v1\shell\overlay.ts`
- `C:\Users\samar\lpa-v1\engine\dictation\flow.py`

Useful ideas include one serialized COM thread, fresh endpoint enumeration, preservation of already-muted devices, recovery state, rebindable microphone selection, and pointer-safe overlay placement.

They are evidence, not code to copy. The donor opens the microphone before muting, can claim success after swallowed mute failures, does not mute newly activated outputs, identifies microphones by non-unique friendly names, lacks permission diagnostics, lacks display-topology listeners/tests, and has recovery atomicity gaps. `chat-saas` and `parakeet-test` contain no reusable implementation for this baseline.

## Official sources

### Windows audio and privacy

- Audio endpoint enumeration: https://learn.microsoft.com/en-us/windows/win32/api/mmdeviceapi/nf-mmdeviceapi-immdeviceenumerator-enumaudioendpoints
- Default endpoints and roles: https://learn.microsoft.com/en-us/windows/win32/api/mmdeviceapi/nf-mmdeviceapi-immdeviceenumerator-getdefaultaudioendpoint
- Opaque endpoint identity: https://learn.microsoft.com/en-us/windows/win32/api/mmdeviceapi/nf-mmdeviceapi-immdevice-getid
- Endpoint change notifications: https://learn.microsoft.com/en-us/windows/win32/api/mmdeviceapi/nn-mmdeviceapi-immnotificationclient
- Endpoint mute: https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nf-endpointvolume-iaudioendpointvolume-setmute
- Current mute state: https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nf-endpointvolume-iaudioendpointvolume-getmute
- Volume/mute callback event context: https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/ns-endpointvolume-audio_volume_notification_data
- Endpoint-volume behavior and limitations: https://learn.microsoft.com/en-us/windows/win32/coreaudio/endpointvolume-api
- Windows microphone privacy: https://support.microsoft.com/en-us/windows/windows-camera-microphone-and-privacy
- Windows Settings links: https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings

### Electron displays and permissions

- Electron `screen` topology and events: https://www.electronjs.org/docs/latest/api/screen
- Electron `Display` shape: https://www.electronjs.org/docs/latest/api/structures/display
- Electron window bounds: https://www.electronjs.org/docs/latest/api/browser-window/
- Electron all-workspaces API is unavailable on Windows: https://www.electronjs.org/docs/latest/api/browser-window/#winsetvisibleonallworkspacesvisible-options
- Electron session permission handlers: https://www.electronjs.org/docs/latest/api/session
- Electron media-access status limitations: https://www.electronjs.org/docs/latest/api/system-preferences
- Electron suspend/resume and Windows lock-screen events: https://www.electronjs.org/docs/latest/api/power-monitor
- Electron Windows shutdown/restart/logout quit-event limitation: https://www.electronjs.org/docs/latest/api/app
- Windows end-session messages: https://learn.microsoft.com/en-us/windows/win32/shutdown/wm-queryendsession and https://learn.microsoft.com/en-us/windows/win32/shutdown/wm-endsession
- Windows terminal-session change messages: https://learn.microsoft.com/en-us/windows/win32/termserv/wm-wtssession-change
- Windows virtual-screen coordinates: https://learn.microsoft.com/en-us/windows/win32/gdi/the-virtual-screen
- Windows multi-monitor positioning: https://learn.microsoft.com/en-us/windows/win32/gdi/positioning-objects-on-multiple-display-monitors
- Windows high-DPI guidance: https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows

## Approval record

The founder approved this baseline on 2026-07-19 after reviewing its behavior and security/quality audit. Approval accepts the behavior, failure semantics, privacy boundary, default all-active-output suppression policy, explicit Core Audio same-value/final-race limitation, and implementation sequence. It does not approve a native dependency/toolchain, real microphone capture, real data, signing spend, outside distribution, or deployment.

Recorded approval boundary:

```text
Approved: WINDOWS-HARDWARE-BASELINE-PROPOSAL. Proceed under the recorded task order and gates. Default dictation behavior mutes all active render endpoints, verifies suppression before microphone capture, restores only state with no observed ownership conflict while retaining the recorded Windows same-value/race limitation, handles device/display changes visibly, and uses capability-specific onboarding. No new native dependency/toolchain, real capture/data, signing spend, outside distribution, or deployment without its named approval.
```
