#!/usr/bin/env python3
"""
Convert the open word dataset from github.com/laplaces42/sign-language-interpreter
(MIT license) into Signsational's word-clip format.

    python tools/import_laplaces_words.py [path/to/sign_language.csv]

With no path it downloads the file from GitHub. Writes data/words/laplaces42.csv.

Their format: one row per 15-frame clip, columns "frame, hand, landmark, coord"
in pixels, from a mirrored webcam image, both hands. Ours (see js/signs.js):
one hand, un-mirrored, centered on the wrist and scaled by palm size, plus wrist
movement since the first frame. Only one-handed words are kept, because the
game tracks one hand.
"""
from __future__ import annotations

import csv
import io
import sys
import urllib.request
from pathlib import Path

import numpy as np

URL = "https://raw.githubusercontent.com/laplaces42/sign-language-interpreter/main/sign_language.csv"
OUT = Path(__file__).resolve().parent.parent / "data" / "words" / "laplaces42.csv"
WORDS = {"hello": "HELLO", "thank you": "THANK YOU", "please": "PLEASE", "sorry": "SORRY", "welcome": "WELCOME"}
FRAMES = 15
MIN_FRAMES = 10  # skip clips where the hand was visible in fewer frames than this


def read_rows(path: str | None):
    if path:
        text = Path(path).read_text()
    else:
        print(f"Downloading {URL}")
        text = urllib.request.urlopen(URL).read().decode()
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    return header, list(reader)


def hand_array(row, header, hand):
    """-> (15, 21, 2) pixel coordinates, and which frames had this hand."""
    arr = np.zeros((FRAMES, 21, 2))
    for i, name in enumerate(header):
        parts = [p.strip() for p in name.split(",")]
        if len(parts) == 4 and parts[1] == hand:
            f, lm, c = int(parts[0]), int(parts[2]), parts[3]
            arr[f, lm, 0 if c == "x" else 1] = float(row[i])
    present = np.abs(arr).sum(axis=(1, 2)) > 0
    return arr, present


def clip_features(arr, present):
    # Fill frames where the hand wasn't seen with the nearest frame where it was.
    idx = np.flatnonzero(present)
    nearest = idx[np.abs(np.arange(FRAMES)[:, None] - idx[None, :]).argmin(axis=1)]
    arr = arr[nearest].copy()
    arr[..., 0] *= -1  # their camera image was mirrored; ours isn't
    wrist = arr[:, 0, :]
    size = np.linalg.norm(arr[:, 9, :] - wrist, axis=1)
    size[size == 0] = 1
    shape = (arr - wrist[:, None, :]) / size[:, None, None]
    move = (wrist - wrist[0]) / size.mean()
    return np.concatenate([shape.reshape(FRAMES, 42), move], axis=1).reshape(-1)


def main():
    header, rows = read_rows(sys.argv[1] if len(sys.argv) > 1 else None)
    label_i = header.index("label")
    out, skipped = [], 0
    for row in rows:
        word = WORDS.get(row[label_i].strip().lower())
        if not word:
            continue
        best = None
        for hand in ("L", "R"):
            arr, present = hand_array(row, header, hand)
            path = np.linalg.norm(np.diff(arr[present][:, 0, :], axis=0), axis=1).sum() if present.sum() > 1 else 0
            key = (int(present.sum()), path)
            if best is None or key > best[0]:
                best = (key, arr, present)
        (count, _), arr, present = best
        if count < MIN_FRAMES:
            skipped += 1
            continue
        out.append(["laplaces42", word, *np.round(clip_features(arr, present), 4).tolist()])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["person", "label", *[f"w{i}" for i in range(FRAMES * 44)]])
        w.writerows(out)
    counts = {wd: sum(r[1] == wd for r in out) for wd in WORDS.values()}
    print(f"Wrote {len(out)} clips to {OUT} ({skipped} skipped: hand missing too often).")
    print("  " + ", ".join(f"{k} {v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
