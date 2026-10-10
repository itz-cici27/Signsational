#!/usr/bin/env python3
"""Fixes 4 small problems in js/game.js. Run from the project folder (with index.html):
    python3 fix_stats.py
It checks every spot first. If one is missing it changes nothing.
Undo with:  git restore js/game.js
"""
import sys
from pathlib import Path

MERGE_STATS = '''// Keep the practice stats from both devices: for each letter, use the one with more attempts.
function mergeStats(a, b) {
  const out = { ...(b || {}) };
  for (const [letter, s] of Object.entries(a || {})) {
    if (!out[letter] || (s.attempts || 0) >= (out[letter].attempts || 0)) out[letter] = s;
  }
  return out;
}

function mergeProgress(local, cloud) {'''

EDITS = [
    ("start the letter timer when the camera is ready (otherwise camera start-up time counts as 'slow')",
     '  stopLoop = runLoop(video, tracker, onFrame);',
     '  play.letterStart = performance.now(); // camera start-up time shouldn\'t count toward the letter\'s time\n'
     '  play.lastNudge = performance.now();\n'
     '  stopLoop = runLoop(video, tracker, onFrame);'),
    ("don't record a skip while a letter is already passing",
     '  recordLetterStat(currentTarget(), true);\n  if (play.busy) return;',
     '  if (play.busy) return;\n  recordLetterStat(currentTarget(), true);'),
    ("keep practice stats when signing in (cloud merge was dropping them)",
     '    coins: Math.max(local.coins || 0, cloud.coins || 0),',
     '    coins: Math.max(local.coins || 0, cloud.coins || 0),\n    stats: mergeStats(local.stats, cloud.stats),'),
    ("define mergeStats",
     'function mergeProgress(local, cloud) {',
     MERGE_STATS),
    ("cache-bust the reference pictures (?v=2) so the browser shows the fixed ones",
     '/${letter}.jpg`;',
     '/${letter}.jpg?v=2`;'),
]

game = Path("js/game.js")
if not game.exists():
    sys.exit("Can't find js/game.js. Run this from the project folder (the one with index.html).")
text = game.read_text()
todo = []
for name, old, new in EDITS:
    if new in text:
        print(f"already done: {name}")
        continue
    n = text.count(old)
    if n != 1:
        sys.exit(f"\nNothing was changed.\nThe spot for '{name}' was found {n} times (expected 1).\nSend me your current js/game.js.")
    todo.append((name, old, new))
for name, old, new in todo:
    text = text.replace(old, new)
    print(f"fixed: {name}")
if todo:
    game.write_text(text)
    print("\nDone. Hard refresh the game (Cmd+Shift+R).")
