#!/usr/bin/env python3
"""
Train the letter classifier for Signsational.

1. Put every teammate's CSV (exported from recorder.html) in the data/ folder.
2. Run:  python train.py
3. It prints accuracy numbers and writes model/model.json, which the game
   loads automatically. If matplotlib is installed it also saves
   model/confusion_matrix.png for your pitch slides.

Evaluation is "leave one signer out": the model is trained on everyone except
one person, then tested on that person. That's the honest number to quote,
because it shows how well the app works on a hand it has never seen.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import LeaveOneGroupOut, StratifiedKFold, cross_val_predict
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "model"
FEATURES = [f"f{i}" for i in range(63)]
MIN_PER_LETTER = 10


def build_model():
    return make_pipeline(
        StandardScaler(),
        MLPClassifier(
            hidden_layer_sizes=(64,),
            alpha=1e-3,
            max_iter=800,
            early_stopping=True,
            n_iter_no_change=20,
            random_state=0,
        ),
    )


def load_data() -> pd.DataFrame:
    files = sorted(DATA_DIR.glob("*.csv"))
    if not files:
        sys.exit("No CSV files in data/. Export them from recorder.html first.")
    frames = []
    for f in files:
        df = pd.read_csv(f)
        missing = {"person", "label", *FEATURES} - set(df.columns)
        if missing:
            print(f"Skipping {f.name}: it's missing {len(missing)} expected columns.")
            continue
        frames.append(df[["person", "label", *FEATURES]])
    if not frames:
        sys.exit("None of the CSVs in data/ came from the recorder.")

    df = pd.concat(frames, ignore_index=True).dropna().drop_duplicates()
    df["person"] = df["person"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip().str.upper()

    counts = df["label"].value_counts()
    thin = counts[counts < MIN_PER_LETTER].index.tolist()
    if thin:
        print(f"Dropping letters with fewer than {MIN_PER_LETTER} samples: {', '.join(sorted(thin))}")
        df = df[~df["label"].isin(thin)]

    print(f"Loaded {len(df)} samples from {len(files)} file(s).\n")
    print("Samples per letter and signer:")
    print(pd.crosstab(df["label"], df["person"]).to_string(), "\n")
    return df


def evaluate(df: pd.DataFrame) -> dict:
    X = df[FEATURES].to_numpy(np.float32)
    y = df["label"].to_numpy()
    groups = df["person"].to_numpy()
    people = sorted(set(groups))
    labels = sorted(set(y))
    # Train on integer class ids (string labels trip a bug in some scikit-learn versions).
    y_num = np.searchsorted(labels, y)

    if len(people) >= 2:
        method = f"leave-one-signer-out ({len(people)} signers)"
        pred = cross_val_predict(build_model(), X, y_num, groups=groups, cv=LeaveOneGroupOut())
    else:
        method = "5-fold on a single signer (optimistic; add teammates for an honest number)"
        pred = cross_val_predict(build_model(), X, y_num, cv=StratifiedKFold(5, shuffle=True, random_state=0))
    pred = np.array(labels)[pred]

    overall = accuracy_score(y, pred)
    per_person = {p: float(accuracy_score(y[groups == p], pred[groups == p])) for p in people}
    per_letter = {l: float(accuracy_score(y[y == l], pred[y == l])) for l in labels}
    mean_person = float(np.mean(list(per_person.values()))) if len(people) >= 2 else None

    cm = confusion_matrix(y, pred, labels=labels)
    confusions = [
        (labels[i], labels[j], int(cm[i, j]))
        for i in range(len(labels))
        for j in range(len(labels))
        if i != j and cm[i, j] > 0
    ]
    confusions.sort(key=lambda t: -t[2])

    print(f"Evaluation: {method}")
    print(f"  Overall accuracy: {overall:.1%}")
    if mean_person is not None:
        for p, acc in per_person.items():
            print(f"  Tested on {p}: {acc:.1%}")
        print(f"  Average across signers: {mean_person:.1%}")
    weakest = sorted(per_letter.items(), key=lambda kv: kv[1])[:5]
    print("  Weakest letters: " + ", ".join(f"{l} {a:.0%}" for l, a in weakest))
    if confusions:
        print("  Most common mix-ups: " + ", ".join(f"{a} read as {b} ({n}x)" for a, b, n in confusions[:5]))
    print("  Tip: record more takes of the weakest letters, then retrain.\n")

    save_confusion_plot(cm, labels, method)

    return {
        "method": method,
        "n_samples": int(len(df)),
        "n_signers": len(people),
        "overall_accuracy": float(overall),
        "mean_person_accuracy": mean_person,
        "per_person": per_person,
        "per_letter": per_letter,
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
    fig, ax = plt.subplots(figsize=(9, 9))
    ConfusionMatrixDisplay(cm, display_labels=labels).plot(ax=ax, colorbar=False, cmap="Purples")
    ax.set_title(f"Letter confusion matrix\n{method}")
    fig.tight_layout()
    fig.savefig(MODEL_DIR / "confusion_matrix.png", dpi=150)
    plt.close(fig)
    print(f"Saved {MODEL_DIR / 'confusion_matrix.png'}")


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
        "labels": [labels[int(c)] for c in mlp.classes_],
        "mean": np.round(scaler.mean_, 6).tolist(),
        "scale": np.round(scaler.scale_, 6).tolist(),
        "layers": [
            {"W": np.round(W, 5).tolist(), "b": np.round(b, 5).tolist()}
            for W, b in zip(mlp.coefs_, mlp.intercepts_)
        ],
        "eval": summary,
    }
    out = MODEL_DIR / "model.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"Saved {out} ({out.stat().st_size // 1024} KB, {len(payload['labels'])} letters).")

    if summary["mean_person_accuracy"] is not None:
        print(
            "\nResume line: Trained a neural network on hand-landmark features that recognizes "
            f"{len(payload['labels'])} ASL letters with {summary['mean_person_accuracy']:.0%} "
            "accuracy on signers it never saw."
        )
    else:
        print("\nRecord data from at least 2 people to get a resume-ready accuracy number.")


def main():
    MODEL_DIR.mkdir(exist_ok=True)
    df = load_data()
    if df["label"].nunique() < 3:
        sys.exit("Record at least 3 different letters before training.")
    summary = evaluate(df)
    export(df, summary)


if __name__ == "__main__":
    main()
