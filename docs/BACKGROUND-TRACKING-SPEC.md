# Automatic startup and background tracking

Authorized by the founder on 2026-09-07. Ascend is a personal, visible background app.

- Register this Windows user's sign-in startup using Electron's login-item API. Start quietly in the tray; ordinary launches show the window. Isolated QA profiles never register startup.
- Closing the window hides it. A persistent tray icon shows tracking, paused, or unavailable state and reopens Ascend. There is no permanent in-app pause or Quit menu item.
- Settings offers 4, 24 and 48 hours. Existing pause deadlines survive closing, restart and sign-in, and resume automatically when expired. Existing 1-hour persisted pauses remain compatible.
- The main process supervises tracking independently of renderer visibility, including heartbeat, bounded worker recovery and pause reminders. Worker recovery reads the saved pause and never issues an unconditional resume.
- Normal process exit flushes the activity engine and cancels any transcription. Windows sign-out/shutdown is respected; capture cannot occur while powered off or suspended. No restart loop circumvents Task Manager or an OS-disabled startup entry.
- Startup registration failure and tracking failure stay visible in Settings/tray. A manual Ascend launch restores a disabled or missing sign-in entry; Windows policy can still prevent registration. Keep current encrypted history, app exclusions, title privacy, local-only transcription and dependency pins.
- Verify hidden launch, close-to-tray, continued heartbeat/capture, pause persistence/expiry, worker recovery during a pause, reopening, orderly shutdown and registration read-back. Do not reboot the owner's computer for QA.
