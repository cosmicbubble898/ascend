"""Windows runtime regression: a dead shell must not leave a model worker behind."""

import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / "runtime/uv-python-0.11.29/cpython-3.13.14-windows-x86_64-none/pythonw.exe"


class SupervisionTests(unittest.TestCase):
    def test_parent_exit_stops_worker_during_model_loading(self):
        parent = subprocess.Popen(
            [str(PYTHON), "-I", "-c", "import time; time.sleep(2)"],
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        worker = subprocess.Popen(
            [
                str(PYTHON),
                "-I",
                "-B",
                str(ROOT / "scripts/parakeet-sandbox.py"),
                "--parent",
                str(parent.pid),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        try:
            parent.wait(timeout=5)
            worker.wait(timeout=5)
            worker.stdin.close()
            worker.stdout.close()
        finally:
            if worker.poll() is None:
                worker.kill()
            worker.wait(timeout=5)
            if parent.poll() is None:
                parent.kill()


if __name__ == "__main__":
    unittest.main()
