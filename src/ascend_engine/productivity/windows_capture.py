"""Win32 metadata source. No OCR, pixels, typed text, or network access."""

import ctypes as c
import json
import ntpath
import subprocess
from ctypes import wintypes as w

from ascend_engine.productivity.context_adapters import infer_context
from ascend_engine.productivity.launcher import helper_args
from ascend_engine.productivity.model import Observation
from ascend_engine.productivity.windows_events import WindowsEvents

SENSITIVE_APPS = {
    "1password.exe",
    "bitwarden.exe",
    "keepass.exe",
    "keepassxc.exe",
    "credentialuibroker.exe",
    "logonui.exe",
    "lockapp.exe",
}
PRIVATE_MARKERS = (
    "incognito",
    "inprivate",
    "private browsing",
    "password",
    "sign in",
    "log in",
    "verification code",
)


class LastInput(c.Structure):
    _fields_ = [("size", w.UINT), ("tick", w.DWORD)]


class MonitorInfo(c.Structure):
    _fields_ = [
        ("size", w.DWORD),
        ("monitor", w.RECT),
        ("work", w.RECT),
        ("flags", w.DWORD),
        ("device", w.WCHAR * 32),
    ]


class WindowsCapture:
    def __init__(self) -> None:
        self.user = c.WinDLL("user32", use_last_error=True)
        self.kernel = c.WinDLL("kernel32", use_last_error=True)
        self.events = WindowsEvents()
        signatures = [
            (self.user, "GetForegroundWindow", [], w.HWND),
            (self.user, "GetWindowThreadProcessId", [w.HWND, c.POINTER(w.DWORD)], w.DWORD),
            (self.user, "GetWindowTextW", [w.HWND, w.LPWSTR, c.c_int], c.c_int),
            (self.user, "GetClassNameW", [w.HWND, w.LPWSTR, c.c_int], c.c_int),
            (self.user, "GetLastInputInfo", [c.POINTER(LastInput)], w.BOOL),
            (self.user, "OpenInputDesktop", [w.DWORD, w.BOOL, w.DWORD], w.HANDLE),
            (self.user, "CloseDesktop", [w.HANDLE], w.BOOL),
            (
                self.user,
                "GetUserObjectInformationW",
                [w.HANDLE, c.c_int, c.c_void_p, w.DWORD, c.POINTER(w.DWORD)],
                w.BOOL,
            ),
            (self.user, "MonitorFromWindow", [w.HWND, w.DWORD], w.HANDLE),
            (self.user, "GetMonitorInfoW", [w.HANDLE, c.POINTER(MonitorInfo)], w.BOOL),
            (self.kernel, "GetTickCount", [], w.DWORD),
            (self.kernel, "OpenProcess", [w.DWORD, w.BOOL, w.DWORD], w.HANDLE),
            (self.kernel, "CloseHandle", [w.HANDLE], w.BOOL),
            (
                self.kernel,
                "QueryFullProcessImageNameW",
                [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)],
                w.BOOL,
            ),
            (
                self.kernel,
                "GetApplicationUserModelId",
                [w.HANDLE, c.POINTER(w.UINT), w.LPWSTR],
                c.c_long,
            ),
        ]
        for library, name, arguments, result in signatures:
            function = getattr(library, name)
            function.argtypes, function.restype = arguments, result

    def event_pending(self, generation: int) -> bool:
        return self.events.changed_since(generation)

    def close(self) -> None:
        self.events.close()

    def sample(self, *, details: bool, excluded: list[str], vision: bool = False) -> Observation:
        event_state, event_generation = self.events.snapshot()
        if event_state in ("locked", "suspended"):
            return Observation(state=event_state, event_generation=event_generation)
        desktop = self.user.OpenInputDesktop(0, False, 1)
        if not desktop:
            return Observation(state="locked", event_generation=event_generation)
        try:
            name, needed = c.create_unicode_buffer(128), w.DWORD()
            if (
                not self.user.GetUserObjectInformationW(
                    desktop, 2, name, c.sizeof(name), c.byref(needed)
                )
                or name.value != "Default"
            ):
                return Observation(state="locked", event_generation=event_generation)
        finally:
            self.user.CloseDesktop(desktop)
        last = LastInput(c.sizeof(LastInput), 0)
        if not self.user.GetLastInputInfo(c.byref(last)):
            return Observation(state="unavailable", event_generation=event_generation)
        idle = ((int(self.kernel.GetTickCount()) - int(last.tick)) & 0xFFFFFFFF) / 1000
        handle = self.user.GetForegroundWindow()
        pid = w.DWORD()
        if not handle or not self.user.GetWindowThreadProcessId(handle, c.byref(pid)):
            return Observation(state="unavailable", idle=idle, event_generation=event_generation)
        process = self.kernel.OpenProcess(0x1000, False, pid.value)
        if not process:
            return Observation(state="unavailable", idle=idle, event_generation=event_generation)
        try:
            name, size = c.create_unicode_buffer(32768), w.DWORD(32768)
            if not self.kernel.QueryFullProcessImageNameW(process, 0, name, c.byref(size)):
                return Observation(state="unavailable", idle=idle)
            app = ntpath.basename(name.value).lower()[:120]
            aumid_buffer, aumid_size = c.create_unicode_buffer(512), w.UINT(512)
            aumid = (
                aumid_buffer.value[:160]
                if self.kernel.GetApplicationUserModelId(process, c.byref(aumid_size), aumid_buffer)
                == 0
                else ""
            )
        finally:
            self.kernel.CloseHandle(process)
        if app in SENSITIVE_APPS or app in excluded:
            return Observation(state="excluded", idle=idle, event_generation=event_generation)
        title_buffer = c.create_unicode_buffer(1024)
        self.user.GetWindowTextW(handle, title_buffer, 1024)
        title = title_buffer.value
        if any(marker in title.casefold() for marker in PRIVATE_MARKERS):
            return Observation(state="excluded", idle=idle, event_generation=event_generation)
        class_buffer = c.create_unicode_buffer(256)
        self.user.GetClassNameW(handle, class_buffer, 256)
        window_class = class_buffer.value[:120]
        monitor = MonitorInfo()
        monitor.size = c.sizeof(MonitorInfo)
        display = ""
        if self.user.GetMonitorInfoW(self.user.MonitorFromWindow(handle, 2), c.byref(monitor)):
            display = monitor.device
        context = "app_only"
        domain = ""
        if (details or vision) and idle < 300:
            try:
                result = subprocess.run(
                    helper_args("accessibility", str(pid.value), app),
                    capture_output=True,
                    timeout=1.2,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                    check=True,
                )
                value = json.loads(result.stdout[:4096])
                if value.get("password") is True:
                    return Observation(
                        state="excluded", idle=idle, event_generation=event_generation
                    )
                if value.get("password") is False and isinstance(value.get("role"), int):
                    context = "windows_accessibility"
                    domain = value.get("domain", "")
                    if not isinstance(domain, str):
                        domain = ""
                else:
                    context = "context_unavailable"
            except (OSError, subprocess.SubprocessError, ValueError):
                context = "context_unavailable"
        if not details:
            title = ""
            domain = ""
        if self.user.GetForegroundWindow() != handle:
            return Observation(state="unavailable", idle=idle, event_generation=event_generation)
        inferred = infer_context(app, title, domain)
        return Observation(
            app,
            title[:300],
            display,
            idle,
            "active",
            context,
            int(handle),
            int(pid.value),
            int(last.tick),
            event_generation,
            window_class,
            aumid,
            domain,
            inferred["service"],
            inferred["surface"],
            inferred["summary"],
            inferred["confidence"],
            inferred["source"],
        )
