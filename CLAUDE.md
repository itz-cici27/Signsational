# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Signsational is a browser-based ASL fingerspelling learning game. A webcam tracks the user's hand via MediaPipe, a neural network classifies the handshape, and game logic awards stickers for completing levels. Built for Code Ada 2026, Tech for Equity track.

## Running locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000 (game) or http://localhost:8000/recorder.html (data recorder)
```

JavaScript modules require a local server — double-clicking HTML files won't work. Webcam requires `localhost` or `https://`.

## Training the model

```bash
pip install -r requirements.txt   # pandas, numpy, scikit-learn, matplotlib
python train.py                    # reads data/*.csv, writes model/model.json
```

Uses leave-one-signer-out cross-validation when multiple signers' data is present. Outputs `model/model.json` (loaded by the game automatically) and `model/confusion_matrix.png`.

## Architecture

**Two-mode classifier system:** The game has two classifiers in `js/classifier.js`:
- **MLP** — loads `model/model.json` (trained by `train.py`). This is the production path.
- **kNN** — quick-start fallback using samples saved in the browser's localStorage (via `recorder.html`). Activates when no `model.json` exists and ≥20 samples are recorded locally.

**Data pipeline:** `recorder.html` → user records hand landmarks → stored in localStorage and exportable as CSV → CSVs go in `data/` → `train.py` trains sklearn MLPClassifier → exports weights/biases/scaler to `model/model.json` → `js/classifier.js` reimplements the MLP forward pass in plain JS.

**Key modules:**
- `js/hands.js` — MediaPipe Hand Landmarker setup, camera, feature extraction (21 landmarks → 63 floats centered on wrist, scaled by palm size), hand skeleton drawing
- `js/classifier.js` — MLP and kNN classifiers, `loadClassifier()` entry point
- `js/game.js` — game loop, level progression, word challenges, coin system, shop, settings, streaks. Entry point for `index.html`
- `js/recorder.js` — data collection UI, CSV import/export. Entry point for `recorder.html`
- `js/store.js` — localStorage wrapper for settings, progress, shop inventory, and samples
- `js/letters.js` — letter definitions, level structure (5 levels), word challenge sets, shop item catalog, handshape hints
- `js/mascot.js` — Mochi SVG mascot with equippable accessories (inline SVG, animated via CSS classes)

**Feature vector:** 63 floats = 21 landmarks × 3 coords (x, y, z), centered on wrist, normalized by palm size. Left-handed input is mirrored to match right-handed training data.

**Letters covered:** A–Y excluding J and Z (which require motion). 24 static letters across 5 levels.

**Word challenges:** 4 word sets where users fingerspell complete words letter by letter (e.g. CAT → sign C, then A, then T). Uses the same classifier — no motion recognition needed.

**Coin & shop system:** Coins earned from completing levels (50 first time, 10 replay) and word challenges (30–65 based on difficulty). Spent in Mochi's Shop on SVG accessories (bow, sunglasses, crown, cape, etc.) that render on the mascot. Shop state stored in `sls_shop` localStorage key.

## Important conventions

- No build step or bundler — plain ES modules loaded from CDN (MediaPipe) and local files
- All state is in localStorage; nothing is uploaded. Privacy is a core design value ("Video never leaves this device")
- MediaPipe is loaded from `cdn.jsdelivr.net`, not bundled
- The `train.py` model export format must match what `MLP` class in `classifier.js` expects (labels, mean, scale, layers with W and b matrices)
