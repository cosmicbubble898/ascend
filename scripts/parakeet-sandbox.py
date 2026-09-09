"""Windows AppContainer launcher. No network capabilities; kill-on-close Job Object.

This trusted supervisor only launches the fixed worker (or the public QA probe).
Its private standard pipes are the worker's entire audio/data interface.
"""

import ctypes as c
import subprocess
import sys
from ctypes import wintypes as w
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILE = "Ascend.LocalTranscription.20260905"
K = c.WinDLL("kernel32", use_last_error=True)
U = c.WinDLL("userenv", use_last_error=True)
A = c.WinDLL("advapi32", use_last_error=True)
PTR = c.c_void_p
SIZE = c.c_size_t


class Startup(c.Structure):
    _fields_ = [
        ("cb", w.DWORD),
        ("reserved", w.LPWSTR),
        ("desktop", w.LPWSTR),
        ("title", w.LPWSTR),
        ("x", w.DWORD),
        ("y", w.DWORD),
        ("xs", w.DWORD),
        ("ys", w.DWORD),
        ("xc", w.DWORD),
        ("yc", w.DWORD),
        ("fill", w.DWORD),
        ("flags", w.DWORD),
        ("show", w.WORD),
        ("reserved2size", w.WORD),
        ("reserved2", PTR),
        ("stdin", w.HANDLE),
        ("stdout", w.HANDLE),
        ("stderr", w.HANDLE),
    ]


class StartupEx(c.Structure):
    _fields_ = [("startup", Startup), ("attributes", PTR)]


class ProcessInfo(c.Structure):
    _fields_ = [("process", w.HANDLE), ("thread", w.HANDLE), ("pid", w.DWORD), ("tid", w.DWORD)]


class Capabilities(c.Structure):
    _fields_ = [("sid", PTR), ("capabilities", PTR), ("count", w.DWORD), ("reserved", w.DWORD)]


class BasicLimits(c.Structure):
    _fields_ = [
        ("process_time", c.c_int64),
        ("job_time", c.c_int64),
        ("flags", w.DWORD),
        ("min_ws", SIZE),
        ("max_ws", SIZE),
        ("active_processes", w.DWORD),
        ("affinity", SIZE),
        ("priority", w.DWORD),
        ("scheduling", w.DWORD),
    ]


class JobLimits(c.Structure):
    _fields_ = [
        ("basic", BasicLimits),
        ("io", c.c_uint64 * 6),
        ("process_memory", SIZE),
        ("job_memory", SIZE),
        ("peak_process", SIZE),
        ("peak_job", SIZE),
    ]


def api(dll, name, returns, args):
    function = getattr(dll, name)
    function.restype, function.argtypes = returns, args
    return function


def checked(value):
    if not value:
        raise c.WinError(c.get_last_error())
    return value


def sid():
    result = PTR()
    create = api(
        U,
        "CreateAppContainerProfile",
        c.c_long,
        [w.LPCWSTR, w.LPCWSTR, w.LPCWSTR, PTR, w.DWORD, c.POINTER(PTR)],
    )
    status = create(
        PROFILE, "Ascend local transcription", "Offline Parakeet worker", None, 0, c.byref(result)
    )
    if status == -2147024713:  # HRESULT_FROM_WIN32(ERROR_ALREADY_EXISTS)
        status = api(
            U, "DeriveAppContainerSidFromAppContainerName", c.c_long, [w.LPCWSTR, c.POINTER(PTR)]
        )(PROFILE, c.byref(result))
    if status < 0:
        raise RuntimeError("sandbox_profile")
    return result


def setup():
    package_sid = sid()
    text = w.LPWSTR()
    checked(
        api(A, "ConvertSidToStringSidW", w.BOOL, [PTR, c.POINTER(w.LPWSTR)])(
            package_sid, c.byref(text)
        )
    )
    # Package-specific read/execute grants, never ALL APPLICATION PACKAGES or user data.
    directories = [
        "runtime/parakeet-env",
        "runtime/parakeet-model",
        "runtime/uv-python-0.11.29",
        "scripts",
        "src/ascend_engine/transcription",
        "docs/proposals",
    ]
    for relative in directories:
        directory = (ROOT / relative).resolve(strict=True)
        if not directory.is_relative_to(ROOT):
            raise RuntimeError("sandbox_path")
        subprocess.run(
            ["icacls.exe", str(directory), "/grant", f"*{text.value}:(OI)(CI)RX", "/T", "/Q"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    for relative in [".", "src", "src/ascend_engine", "runtime"]:
        subprocess.run(
            ["icacls.exe", str(ROOT / relative), "/grant", f"*{text.value}:RX"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    # The package initializer is required, but its sibling storage module is not granted.
    subprocess.run(
        ["icacls.exe", str(ROOT / "src/ascend_engine/__init__.py"), "/grant", f"*{text.value}:R"],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    print("sandbox_readonly_grants_ready")


def launch(probe=False, parent_pid=None):
    parent = None
    if parent_pid is not None:
        parent = checked(
            api(K, "OpenProcess", w.HANDLE, [w.DWORD, w.BOOL, w.DWORD])(0x100000, False, parent_pid)
        )
    caps = Capabilities(sid(), None, 0, 0)
    size = SIZE()
    initialize = api(
        K, "InitializeProcThreadAttributeList", w.BOOL, [PTR, w.DWORD, w.DWORD, c.POINTER(SIZE)]
    )
    initialize(None, 3, 0, c.byref(size))
    attributes = c.create_string_buffer(size.value)
    checked(initialize(attributes, 3, 0, c.byref(size)))
    update = api(K, "UpdateProcThreadAttribute", w.BOOL, [PTR, w.DWORD, SIZE, PTR, SIZE, PTR, PTR])
    checked(update(attributes, 0, 0x20009, c.byref(caps), c.sizeof(caps), None, None))
    child_policy = w.DWORD(1)
    checked(
        update(attributes, 0, 0x2000E, c.byref(child_policy), c.sizeof(child_policy), None, None)
    )
    get_std = api(K, "GetStdHandle", w.HANDLE, [w.DWORD])
    handles = (w.HANDLE * 3)(get_std(-10), get_std(-11), get_std(-12))
    for handle in handles:
        checked(api(K, "SetHandleInformation", w.BOOL, [w.HANDLE, w.DWORD, w.DWORD])(handle, 1, 1))
    checked(update(attributes, 0, 0x20002, handles, c.sizeof(handles), None, None))
    startup = StartupEx()
    startup.startup.cb = c.sizeof(startup)
    startup.startup.flags = 0x100  # STARTF_USESTDHANDLES
    startup.startup.stdin, startup.startup.stdout, startup.startup.stderr = handles
    startup.attributes = c.cast(attributes, PTR)
    info = ProcessInfo()
    script = "parakeet-probe.py" if probe else "parakeet-worker.py"
    command = subprocess.list2cmdline(
        [
            str(ROOT / "runtime/uv-python-0.11.29/cpython-3.13.14-windows-x86_64-none/pythonw.exe"),
            "-I",
            "-B",
            "-u",
            str(ROOT / "scripts" / script),
        ]
    )
    limits = JobLimits()
    limits.basic.flags = 0x2000 | 0x100 | 0x8  # kill on close, process memory, active count
    limits.basic.active_processes = 1
    limits.process_memory = 8 * 1024**3
    job = checked(api(K, "CreateJobObjectW", w.HANDLE, [PTR, w.LPCWSTR])(None, None))
    checked(
        api(K, "SetInformationJobObject", w.BOOL, [w.HANDLE, c.c_int, PTR, w.DWORD])(
            job, 9, c.byref(limits), c.sizeof(limits)
        )
    )
    create = api(
        K,
        "CreateProcessW",
        w.BOOL,
        [w.LPCWSTR, w.LPWSTR, PTR, PTR, w.BOOL, w.DWORD, PTR, w.LPCWSTR, PTR, PTR],
    )
    checked(
        create(
            None,
            c.create_unicode_buffer(command),
            None,
            None,
            True,
            0x08000000 | 0x80000 | 4,
            None,
            str(ROOT / "scripts"),
            c.byref(startup),
            c.byref(info),
        )
    )
    try:
        checked(api(K, "AssignProcessToJobObject", w.BOOL, [w.HANDLE, w.HANDLE])(job, info.process))
        if api(K, "ResumeThread", w.DWORD, [w.HANDLE])(info.thread) == 0xFFFFFFFF:
            raise RuntimeError("sandbox_resume")
        if parent:
            watched = (w.HANDLE * 2)(info.process, parent)
            wait = api(K, "WaitForMultipleObjects", w.DWORD, [w.DWORD, PTR, w.BOOL, w.DWORD])
            if wait(2, watched, False, 4 * 60 * 60 * 1000) != 0:
                return 1  # Parent exit or timeout: finally terminates the owned Job Object.
        else:
            wait = api(K, "WaitForSingleObject", w.DWORD, [w.HANDLE, w.DWORD])
            if wait(info.process, 4 * 60 * 60 * 1000) != 0:
                raise RuntimeError("worker_timeout")
        code = w.DWORD()
        checked(
            api(K, "GetExitCodeProcess", w.BOOL, [w.HANDLE, c.POINTER(w.DWORD)])(
                info.process, c.byref(code)
            )
        )
        return code.value
    finally:
        api(K, "TerminateProcess", w.BOOL, [w.HANDLE, w.UINT])(info.process, 1)
        close = api(K, "CloseHandle", w.BOOL, [w.HANDLE])
        close(info.thread)
        close(info.process)
        close(job)
        if parent:
            close(parent)


if __name__ == "__main__":
    if sys.argv[1:] == ["--setup"]:
        setup()
    elif len(sys.argv) == 3 and sys.argv[1] == "--drive":
        drive = sys.argv[2]
        if (
            len(drive) != 3
            or not drive[0].isascii()
            or not drive[0].isalpha()
            or drive[1:] != ":\\"
        ):
            sys.exit(1)
        print(api(K, "GetDriveTypeW", w.UINT, [w.LPCWSTR])(drive), flush=True)
    else:
        try:
            parent_pid = None
            if len(sys.argv) == 3 and sys.argv[1] == "--parent":
                parent_pid = int(sys.argv[2])
            elif sys.argv[1:] not in ([], ["--probe"]):
                raise RuntimeError("invalid_arguments")
            sys.exit(launch(probe=sys.argv[1:] == ["--probe"], parent_pid=parent_pid))
        except Exception:
            # Never expose native errors, command lines, or paths to logs or the renderer.
            print('{"type":"error","code":"sandbox_unavailable"}', flush=True)
            sys.exit(1)
