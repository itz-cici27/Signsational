#!/usr/bin/env python3
"""
Convert WLASL videos (dxli94.github.io/WLASL, C-UDA license: academic and
computational use only) into Signsational's word-clip format.

    pip install mediapipe==0.10.14 opencv-python-headless
    python tools/import_wlasl_words.py --videos path/to/wlasl/videos
    python tools/import_wlasl_words.py --kaggle      # downloads only the videos it needs
    python tools/import_wlasl_words.py --online      # no account: original non-YouTube links

--videos is the videos/ folder from the Kaggle dataset "WLASL (World Level American
Sign Language) Video" (risangbaskoro/wlasl-processed), where each file is
<video_id>.mp4. --kaggle fetches just those files with the Kaggle API instead of the
whole 5 GB download (needs a Kaggle API token: KAGGLE_API_TOKEN,
~/.kaggle/access_token, or ~/.kaggle/kaggle.json). --online tries each video's
original link from the JSON (YouTube links are skipped); only some still work.

Writes data/words/wlasl.csv. Each video is run through the same MediaPipe hand
model the game uses, the signing hand is picked, and the sign is cut into
overlapping 0.8-second clips exactly like words-recorder.html does (see js/signs.js).
"""
from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import os
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

import numpy as np

os.environ.setdefault("GLOG_minloglevel", "2")  # quieten MediaPipe's C++ logging

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "words" / "wlasl.csv"
CACHE = Path.home() / ".cache" / "signsational"
JSON_URL = "https://raw.githubusercontent.com/dxli94/WLASL/master/start_kit/WLASL_v0.3.json"
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/1/hand_landmarker.task")
KAGGLE_DATASET = "risangbaskoro/wlasl-processed"

# WLASL gloss -> word in js/signs.js
WORDS = {"yes": "YES", "no": "NO", "eat": "EAT"}

# Must match js/signs.js
SIGN_FRAMES = 15
SIGN_WINDOW_MS = 800
MAX_GAP_MS = 150
STRIDE_MS = 200  # a bit denser than the recorder's 300 ms, since each video is one short sign
WLASL_FPS = 25  # frame_start / frame_end in the JSON are counted at 25 fps


def fetch(url: str, dest: Path) -> Path:
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {url}")
        urllib.request.urlretrieve(url, dest)
    return dest


def instances(json_path: Path):
    for entry in json.loads(json_path.read_text()):
        word = WORDS.get(entry["gloss"])
        if word:
            for inst in entry["instances"]:
                yield word, inst


def kaggle_auth() -> str:
    """Authorization header from a Kaggle API token (new style) or kaggle.json (old style)."""
    token = os.environ.get("KAGGLE_API_TOKEN")
    token_file = Path.home() / ".kaggle" / "access_token"
    if not token and token_file.exists():
        token = token_file.read_text().strip()
    if token:
        return f"Bearer {token}"
    creds_file = Path.home() / ".kaggle" / "kaggle.json"
    if creds_file.exists():
        creds = json.loads(creds_file.read_text())
        return "Basic " + base64.b64encode(f"{creds['username']}:{creds['key']}".encode()).decode()
    sys.exit("No Kaggle token. Create one at kaggle.com > Settings > API and save it to ~/.kaggle/access_token.")


def kaggle_download(video_ids, dest: Path) -> Path:
    auth = kaggle_auth()
    dest.mkdir(parents=True, exist_ok=True)
    for n, vid in enumerate(video_ids, 1):
        mp4 = dest / f"{vid}.mp4"
        if mp4.exists():
            continue
        print(f"\rDownloading videos from Kaggle: {n}/{len(video_ids)}", end="", flush=True)
        url = f"https://www.kaggle.com/api/v1/datasets/download/{KAGGLE_DATASET}/videos%2F{vid}.mp4"
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": auth}), timeout=60).read()
        except urllib.error.HTTPError as err:
            if err.code in (401, 403):
                sys.exit("\nKaggle rejected the token. Make a new one at kaggle.com > Settings > API.")
            continue  # 404: not every WLASL video made it into the Kaggle copy
        if data[:2] == b"PK":  # Kaggle zips single files
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                data = z.read(z.namelist()[0])
        mp4.write_bytes(data)
    print()
    return dest


def online_download(todo, dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    for _, inst in todo:
        mp4, url = dest / f"{inst['video_id']}.mp4", inst["url"]
        if mp4.exists() or "youtu" in url:
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=20).read()
        except Exception:
            continue  # dead link
        if data[4:8] in (b"ftyp", b"moov") or data[:4] == b"\x1aE\xdf\xa3":  # MP4 / WebM, not an HTML error page
            mp4.write_bytes(data)
    return dest


def track(video: Path, landmarker_options):
    """-> list of (t_ms, {hand_label: (21, 3) landmarks}), and the frame aspect ratio."""
    import cv2
    import mediapipe as mp

    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or WLASL_FPS
    aspect = (cap.get(cv2.CAP_PROP_FRAME_WIDTH) / cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 4 / 3
    frames = []
    with mp.tasks.vision.HandLandmarker.create_from_options(landmarker_options) as lmk:
        i = 0
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            t = i * 1000 / fps
            i += 1
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            res = lmk.detect_for_video(image, int(t))
            hands = {}
            for lm, hd in zip(res.hand_landmarks, res.handedness):
                hands[hd[0].category_name] = np.array([[p.x, p.y, p.z] for p in lm])
            frames.append((t, hands))
    cap.release()
    return frames, aspect


def trim(frames, inst):
    """Keep only the sign if the video still contains more than frame_start..frame_end."""
    start, end = inst["frame_start"], inst["frame_end"]
    if end == -1 or not frames or frames[-1][0] < (end - 1) * 1000 / WLASL_FPS:
        return frames  # already cut to the sign
    lo, hi = (start - 1) * 1000 / WLASL_FPS, end * 1000 / WLASL_FPS
    return [f for f in frames if lo <= f[0] <= hi]


def signing_hand(frames):
    """The hand seen most often, ties broken by how far its wrist travels."""
    best = None
    for label in {h for _, hands in frames for h in hands}:
        pts = [hands[label] for _, hands in frames if label in hands]
        path = sum(np.linalg.norm(b[0, :2] - a[0, :2]) for a, b in zip(pts, pts[1:]))
        key = (len(pts), path)
        if best is None or key > best[0]:
            best = (key, label)
    return best and best[1]


def frame_info(lm, aspect):
    """Port of frameInfo() in js/signs.js (right-handed, so no flip)."""
    wrist = lm[0]
    size = np.hypot((lm[9, 0] - wrist[0]) * aspect, lm[9, 1] - wrist[1]) or 1.0
    shape = np.stack([(lm[:, 0] - wrist[0]) * aspect / size, (lm[:, 1] - wrist[1]) / size], axis=1)
    return {"shape": shape.reshape(-1), "wx": wrist[0] * aspect, "wy": wrist[1], "size": size}


def clip_at(timed, start, end):
    """Port of clipAt() in js/signs.js."""
    picked, j = [], 0
    for i in range(SIGN_FRAMES):
        t = start + (end - start) * i / (SIGN_FRAMES - 1)
        while j + 1 < len(timed) and abs(timed[j + 1][0] - t) <= abs(timed[j][0] - t):
            j += 1
        if not timed or abs(timed[j][0] - t) > MAX_GAP_MS:
            return None
        picked.append(timed[j][1])
    size = np.mean([f["size"] for f in picked])
    out = []
    for f in picked:
        out.extend(f["shape"])
        out.extend([(f["wx"] - picked[0]["wx"]) / size, (f["wy"] - picked[0]["wy"]) / size])
    return out


def slice_take(timed):
    """Port of sliceTake() in js/signs.js."""
    if not timed:
        return []
    clips, end = [], timed[0][0] + SIGN_WINDOW_MS
    while end <= timed[-1][0]:
        clip = clip_at(timed, end - SIGN_WINDOW_MS, end)
        if clip:
            clips.append(clip)
        end += STRIDE_MS
    return clips


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--videos", type=Path, help="folder of WLASL <video_id>.mp4 files")
    src.add_argument("--kaggle", action="store_true", help="download only the needed videos from Kaggle")
    src.add_argument("--online", action="store_true", help="try the original (non-YouTube) video links")
    ap.add_argument("--json", type=Path, help="WLASL_v0.3.json (downloaded from GitHub if left out)")
    args = ap.parse_args()

    import mediapipe as mp

    json_path = args.json or fetch(JSON_URL, CACHE / "WLASL_v0.3.json")
    todo = list(instances(json_path))
    if args.videos:
        videos = args.videos
    elif args.kaggle:
        videos = kaggle_download([i["video_id"] for _, i in todo], CACHE / "wlasl_videos")
    else:
        videos = online_download(todo, CACHE / "wlasl_videos")
    model = fetch(MODEL_URL, CACHE / "hand_landmarker.task")
    options = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_hands=2,  # find both, then keep the signing hand (the game tracks one)
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    rows, used, missing, empty = [], {w: 0 for w in WORDS.values()}, 0, 0
    for n, (word, inst) in enumerate(todo, 1):
        video = videos / f"{inst['video_id']}.mp4"
        if not video.exists():
            missing += 1
            continue
        print(f"[{n}/{len(todo)}] {word} {video.name}", end="", flush=True)
        frames, aspect = track(video, options)
        frames = trim(frames, inst)
        hand = signing_hand(frames)
        timed = [(t, frame_info(hands[hand], aspect)) for t, hands in frames if hand in hands]
        clips = slice_take(timed)
        print(f": {len(clips)} clips")
        if not clips:
            empty += 1
            continue
        used[word] += 1
        person = f"wlasl_{inst['signer_id']}"
        rows.extend([person, word, *np.round(c, 4).tolist()] for c in clips)

    if not rows:
        sys.exit(f"No clips made. {missing} of {len(todo)} videos weren't found in {videos}.")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["person", "label", *[f"w{i}" for i in range(SIGN_FRAMES * 44)]])
        w.writerows(rows)
    counts = {wd: sum(r[1] == wd for r in rows) for wd in WORDS.values()}
    print(f"\nWrote {len(rows)} clips to {OUT}.")
    print("  Clips: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    print("  Videos used: " + ", ".join(f"{k} {v}" for k, v in used.items()))
    print(f"  {missing} videos not found, {empty} with no usable hand.")


if __name__ == "__main__":
    main()
