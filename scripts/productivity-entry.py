"""Relocatable, allowlisted entry for the standard-library productivity services."""

import runpy
import sys
from pathlib import Path

MODULES = {
    "ascend_engine.productivity.service",
    "ascend_engine.productivity.accessibility",
    "ascend_engine.productivity.local_classifier",
}
if len(sys.argv) < 2 or sys.argv[1] not in MODULES:
    raise SystemExit(2)
module = sys.argv[1]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.argv = [module, *sys.argv[2:]]
runpy.run_module(module, run_name="__main__")
