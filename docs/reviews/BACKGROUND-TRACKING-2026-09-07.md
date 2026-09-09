# Automatic startup and background tracking — verified locally

The founder requested automatic Windows startup and continuing personal tracking unless paused. Implemented against [the approved scope](../BACKGROUND-TRACKING-SPEC.md).

## Delivered behavior

- Current-user Windows sign-in registration named Ascend. Login launches quietly with `--ascend-background`; manual launches reopen the resident window.
- Closing the window hides it while the tray, activity engine, existing transcription and reminders continue. The tray exposes current tracking/pause/error status and reopening; there is no permanent pause or Quit menu item.
- Settings presents 4, 24 and 48 hours. Persisted deadlines survive startup and worker recovery. Expired pauses resume automatically; existing one-hour deadlines remain compatible.
- The main process starts/supervises the engine without depending on renderer polling. A failed child is retried on the ten-second heartbeat using a state request, preserving its pause rather than forcibly resuming.
- Normal exit closes the engine input pipe and waits for saving. Windows session-end is respected. No Windows service, external watchdog, microphone/OCR capture, new dependency or cloud route was added.

## Verification

- Native Electron background scenario passed: hidden startup; close-to-tray; same tracking child alive after 40 seconds with no test-driven renderer polling; encrypted checkpoint present; all pause durations; paused-worker termination/recovery preserving the exact deadline and reminder; pause persistence across restart; expired-pause resumption; manual reopening.
- The hardened packaged executable starts in background using its bundled engine, creates its isolated encrypted vault, and does not register test profiles for login. Production Electron fuses remain unchanged.
- 21 shell tests, 31 Node policy tests and 104 Python tests passed. Build, TypeScript, ESLint, Prettier and diff checks passed. A stale documentation-policy test was updated to validate current AGENTS.md terminology instead of reinstating the deliberately removed JUNIOR_WORKFLOW.md.
- The actual current-user Run entry was registered and inspected. Windows CommandLineToArgvW confirmed the exact executable, checkout path and background flag. The latest running app saved its verified `login-startup-v1.json` registration record. Windows reports the named Ascend entry enabled.
- Native verification caught two Electron-specific differences: this pinned implementation quotes argument strings itself, and `launchItems.args` reports positional arguments without switches. The status check validates the named entry, executable and positional path; full startup flags were independently verified with Windows' parser. Tests reflect the observed native response instead of assuming the generic `openAtLogin` field describes a custom-named entry.

The owner app is left running in the tray from `C:\Users\samar\Desktop\ascend`. During final activation, only instances started by this task were replaced; their tracking engines were allowed to exit and save before replacement. No activity contents were opened or history deleted.

## Security and limits

Startup is per user, not elevated or system-wide. Isolated QA profiles skip registration. A saved registration prevents silently undoing a later Windows Startup disable. Exclusions, encrypted storage, IPC validation, renderer network denial and local transcription isolation remain unchanged. Tray status contains no window titles or transcript text. Registration failure is visible in Settings; tracking failure is visible in the tray. Background recovery never grants new capture permissions or cancels a saved pause.

No reboot/logoff was performed on the owner's computer. Windows suspension, forced termination, machine shutdown, Explorer behavior, managed startup policy and notification suppression remain platform constraints; the app does not circumvent Task Manager or Windows Startup controls. This is local-machine verification, not signed-installer or public-distribution qualification.

Official API references: [Electron login-item registration](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows), [Tray](https://www.electronjs.org/docs/latest/api/tray), [Windows session-end lifecycle](https://www.electronjs.org/docs/latest/api/browser-window#event-session-end-windows).
