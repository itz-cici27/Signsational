#!/usr/bin/env python3
"""
Train the whole-word sign classifier for Signsational (HELLO, THANK YOU, ...).

1. Put word CSVs (exported from words-recorder.html) in data/words/.
   data/words/laplaces42.csv is starter data converted from an open dataset
   (see data/words/README.md).
2. Run:  python train_words.py
3. It writes model/words.json, which signs.html loads automatically.

Two extra tricks, because word data is scarce:
- A "NONE" class (not a word) is made from the letter recordings in data/*.csv:
  a letter handshape held still is not a word sign. This stops the game from
  hearing HELLO every time you hold your hand up.
- Every clip is also added mirrored, so the model works for either hand.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import LeaveOneGroupOut, StratifiedKFold, cross_val_predict

from train import build_model

ROOT = Path(__file__).resolve().parent
WORDS_DIR = ROOT / "data" / "words"
LETTERS_DIR = ROOT / "data"
MODEL_DIR = ROOT / "model"
FRAMES, PER_FRAME = 15, 44  # must match js/signs.js
FEATURES = [f"w{i}" for i in range(FRAMES * PER_FRAME)]
MIN_PER_WORD = 10
NONE_PER_SIGNER = 40
rng = np.random.default_rng(0)


def load_words() -> pd.DataFrame:
    files = sorted(WORDS_DIR.glob("*.csv"))
    if not files:
        sys.exit("No CSV files in data/words/. Run tools/import_laplaces_words.py or record some words first.")
    frames = []
    for f in files:
        df = pd.read_csv(f)
        if {"person", "label", *FEATURES} - set(df.columns):
            print(f"Skipping {f.name}: it isn't a word-clip CSV.")
            continue
        frames.append(df[["person", "label", *FEATURES]])
    if not frames:
        sys.exit("None of the CSVs in data/words/ came from the word recorder.")
    df = pd.concat(frames, ignore_index=True).dropna().drop_duplicates()
    df["person"] = df["person"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip().str.upper()
    return df


def still_letter_clips() -> pd.DataFrame:
    """NONE examples: letter handshapes from data/*.csv held still with a little jitter."""
    rows = []
    for f in sorted(LETTERS_DIR.glob("*.csv")):
        df = pd.read_csv(f)
        cols = [f"f{i}" for i in range(63)]
        if {"person", *cols} - set(df.columns):
            continue
        for person, group in df.groupby("person"):
            picks = group.sample(min(NONE_PER_SIGNER, len(group)), random_state=0)
            for shape in picks[cols].to_numpy(np.float32):
                xy = shape.reshape(21, 3)[:, :2].reshape(-1)  # drop z
                clip = np.tile(np.append(xy, [0, 0]), (FRAMES, 1))
                clip[:, :42] += rng.normal(0, 0.03, (FRAMES, 42))
                clip[1:, 42:] += rng.normal(0, 0.03, (FRAMES - 1, 2))
                rows.append([str(person), "NONE", *np.round(clip.reshape(-1), 4)])
    return pd.DataFrame(rows, columns=["person", "label", *FEATURES])


def mirrored(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    x_cols = [f"w{f * PER_FRAME + i}" for f in range(FRAMES) for i in [*range(0, 42, 2), 42]]
    out[x_cols] = -out[x_cols]
    return out


def load_data() -> pd.DataFrame:
    words = load_words()
    has_none = (words["label"] == "NONE").any()
    none = still_letter_clips()
    df = pd.concat([words, none], ignore_index=True)

    counts = df["label"].value_counts()
    thin = counts[counts < MIN_PER_WORD].index.tolist()
    if thin:
        print(f"Dropping words with fewer than {MIN_PER_WORD} clips: {', '.join(sorted(thin))}")
        df = df[~df["label"].isin(thin)]

    print(f"Loaded {len(words)} word clips" + (" (including recorded NONE clips)" if has_none else "")
          + f" and made {len(none)} still-hand NONE clips from the letter data.\n")
    print("Clips per word and signer (before mirroring):")
    print(pd.crosstab(df["label"], df["person"]).to_string(), "\n")
    return pd.concat([df, mirrored(df)], ignore_index=True)


def evaluate(df: pd.DataFrame) -> dict:
    X = df[FEATURES].to_numpy(np.float32)
    y = df["label"].to_numpy()
    groups = df["person"].to_numpy()
    labels = sorted(set(y))
    y_num = np.searchsorted(labels, y)
    signers = sorted(set(df.loc[df["label"] != "NONE", "person"]))

    if len(signers) >= 2:
        method = f"leave-one-signer-out ({len(signers)} signers of words)"
        pred = cross_val_predict(build_model(), X, y_num, groups=groups, cv=LeaveOneGroupOut())
    else:
        method = ("5-fold with one word signer (very optimistic: clips from the same recording "
                  "overlap; record your own signers for an honest number)")
        pred = cross_val_predict(build_model(), X, y_num, cv=StratifiedKFold(5, shuffle=True, random_state=0))
    pred = np.array(labels)[pred]

    is_word = y != "NONE"
    overall = accuracy_score(y, pred)
    per_person = {p: float(accuracy_score(y[(groups == p) & is_word], pred[(groups == p) & is_word])) for p in signers}
    per_word = {l: float(accuracy_score(y[y == l], pred[y == l])) for l in labels}
    mean_person = float(np.mean(list(per_person.values()))) if len(signers) >= 2 else None
    cm = confusion_matrix(y, pred, labels=labels)
    confusions = sorted(
        ((labels[i], labels[j], int(cm[i, j])) for i in range(len(labels)) for j in range(len(labels))
         if i != j and cm[i, j] > 0),
        key=lambda t: -t[2],
    )

    print(f"Evaluation: {method}")
    print(f"  Overall accuracy: {overall:.1%}")
    if mean_person is not None:
        for p, acc in per_person.items():
            print(f"  Words signed by {p}: {acc:.1%}")
        print(f"  Average across signers: {mean_person:.1%}")
    print("  Per word: " + ", ".join(f"{l} {a:.0%}" for l, a in sorted(per_word.items(), key=lambda kv: kv[1])))
    if confusions:
        print("  Most common mix-ups: " + ", ".join(f"{a} read as {b} ({n}x)" for a, b, n in confusions[:5]))
    print()
    save_confusion_plot(cm, labels, method)
    return {
        "method": method,
        "n_samples": int(len(df)),
        "n_signers": len(signers),
        "overall_accuracy": float(overall),
        "mean_person_accuracy": mean_person,
        "per_person": per_person,
        "per_word": per_word,
        "top_confusions": confusions[:10],
    }


def save_confusion_plot(cm, labels, method):
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from sklearn.metrics import ConfusionMatrixDisplay
    except ImportError:
        return
    fig, ax = plt.subplots(figsize=(7, 7))
    ConfusionMatrixDisplay(cm, display_labels=labels).plot(ax=ax, colorbar=False, cmap="Purples", xticks_rotation=45)
    ax.set_title(f"Word confusion matrix\n{method[:60]}")
    fig.tight_layout()
    fig.savefig(MODEL_DIR / "words_confusion_matrix.png", dpi=150)
    plt.close(fig)
    print(f"Saved {MODEL_DIR / 'words_confusion_matrix.png'}")


def export(df: pd.DataFrame, summary: dict):
    X = df[FEATURES].to_numpy(np.float32)
    labels = sorted(set(df["label"]))
    y_num = np.searchsorted(labels, df["label"].to_numpy())
    model = build_model().fit(X, y_num)
    scaler = model.named_steps["standardscaler"]
    mlp = model.named_steps["mlpclassifier"]
    assert mlp.activation == "relu" and mlp.out_activation_ == "softmax"

    payload = {
        "type": "mlp",
        "kind": "words",
        "frames": FRAMES,
        "per_frame": PER_FRAME,
        "labels": [labels[int(c)] for c in mlp.classes_],
        "mean": np.round(scaler.mean_, 6).tolist(),
        "scale": np.round(scaler.scale_, 6).tolist(),
        "layers": [
            {"W": np.round(W, 5).tolist(), "b": np.round(b, 5).tolist()}
            for W, b in zip(mlp.coefs_, mlp.intercepts_)
        ],
        "eval": summary,
    }
    out = MODEL_DIR / "words.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    words = [l for l in payload["labels"] if l != "NONE"]
    print(f"Saved {out} ({out.stat().st_size // 1024} KB, words: {', '.join(words)}).")


def main():
    MODEL_DIR.mkdir(exist_ok=True)
    df = load_data()
    if df["label"].nunique() < 3:
        sys.exit("Need at least 2 words (plus NONE) before training.")
    summary = evaluate(df)
    export(df, summary)


if __name__ == "__main__":
    main()
