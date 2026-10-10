#!/usr/bin/env python3
"""Run the Signsational practice feature patches in the intended order.
Run this from the repository root (the folder containing index.html).
"""
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
SCRIPTS = ["apply_practice.py", "fix_stats.py", "restyle_stacks.py"]

if not Path("js/game.js").exists() or not Path("css/style.css").exists():
    sys.exit("Can't find js/game.js and css/style.css. Run this from the Signsational repository root.")

for script in SCRIPTS:
    print(f"\n=== Running {script} ===", flush=True)
    result = subprocess.run([sys.executable, str(HERE / script)])
    if result.returncode != 0:
        sys.exit(f"Stopped at {script}; inspect its message. No further patches were run.")

print("\nFinished running all patches. Inspect `git diff` and test the app before committing.")
