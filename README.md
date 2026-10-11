# Signsational

A free, browser-based game for learning ASL fingerspelling and signs. Your webcam tracks your hand, a neural network checks your handshape, and Mochi the mascot cheers you on. Built for Code Ada 2026, **Tech for Equity** track.

**Live site:** [signsational-2026.web.app](https://signsational-2026.web.app)

## Why it matters

Most deaf children are born to hearing parents, and many of those families never become fluent signers. ASL classes cost money and time, and free apps mostly offer videos with no feedback on whether you're signing correctly. Signsational gives anyone with a webcam real-time feedback for free, so the hearing people around a Deaf person can share the work of communicating.

## Features

- **All 26 letters** — 24 static letters recognized from a single frame, plus J and Z recognized from motion clips
- **9 ASL signs** — full signs with movement (HELLO, THANK YOU, PLEASE, SORRY, WELCOME, YES, NO, EAT, I LOVE YOU)
- **Word spelling** — fingerspell 20 words letter by letter across 4 difficulty sets, plus custom words
- **Daily streaks & leaderboard** — practice daily to climb the ranks (requires sign-in)
- **Coin economy & shop** — earn coins from practice, spend them on accessories for Mochi across 5 rarity tiers (Common → Legendary)
- **Mochi mascot** — animated SVG mascot with 8 color flavors, equippable accessories, and mood states
- **Achievement stickers** — 11 milestone stickers to collect
- **Smart review** — "Worst to Best" mode surfaces the letters that take you longest
- **Accounts** — optional Google sign-in syncs progress across devices via Firestore
- **Privacy first** — video never leaves your device; all state defaults to localStorage
- **Accessible** — Atkinson Hyperlegible font, keyboard navigation, adjustable text size, left-hand mode, no sound dependency

## How it works

1. **Hand tracking.** MediaPipe Hand Landmarker finds 21 points on your hand, in the browser. Video never leaves the device.
2. **Features.** The 21 points are centered on the wrist and scaled by palm size (63 numbers), so position and distance from the camera don't matter. Left-handed signers are mirrored.
3. **Classifier.** A neural network (MLP) trained on data from 5 signers using leave-one-signer-out cross-validation. Runs in plain JavaScript — no server needed.
4. **Motion recognition.** J, Z, and sign words use a clip-based model that watches ~1 second of movement (15 frames resampled into 660 features).
5. **Game logic.** A letter counts when the model is confident for about half a second, which prevents flickers. Three difficulty modes adjust the threshold.

## Run it locally

```bash
cd Signsational
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). Webcams require `localhost` or `https://`. You need internet for MediaPipe and fonts (loaded from CDN).

## Deploy

The site is hosted on Firebase Hosting. To redeploy after changes:

```bash
firebase deploy --only hosting
```

To deploy Firestore security rules as well:

```bash
firebase deploy --only firestore:rules,hosting
```

## Data and training

1. Volunteers record hand landmarks using `recorder.html` (letters) or `words-recorder.html` (signs).
2. CSVs go in `data/` (letters) or `data/words/` (signs).
3. Train:
   ```bash
   pip install -r requirements.txt
   python train.py           # letters → model/model.json
   python train_words.py     # signs → model/words.json
   ```
4. Training uses leave-one-signer-out cross-validation for honest accuracy on unseen hands.
5. Commit the model files. The game loads them automatically.

## Project structure

```
index.html              game: tabs (Home, Letters, Words, Review, Shop, Leaderboard, Volunteer)
recorder.html           volunteer tool for recording letter data
words-recorder.html     volunteer tool for recording sign/motion data
signs.html              play screen for sign words

js/game.js              main game logic, tabs, shop, leaderboard
js/hands.js             MediaPipe setup, camera, feature extraction, drawing
js/classifier.js        MLP and kNN classifiers
js/signs.js             clip model for motion letters and sign words
js/letters.js           letter/word/shop data definitions
js/mascot.js            Mochi SVG with accessories and flavors
js/stickers.js          achievement sticker system
js/store.js             localStorage wrapper (settings, progress, shop, stats)
js/firebase.js          Firebase Auth, Firestore sync, leaderboard
js/flavor-menu.js       Mochi color picker
js/recorder.js          letter data collection UI
js/words-recorder.js    sign data collection UI
js/signs-game.js        sign words play screen logic
js/sign-words-home.js   sign word cards on the Words tab

css/style.css           all styles
css/signs.css           sign-specific styles

train.py                letter model training + evaluation
train_words.py          sign/motion model training + evaluation
firestore.rules         Firestore security rules
firebase.json           Firebase Hosting config

data/                   training CSVs
model/                  model.json, words.json, confusion matrices
assets/signs/           reference photos (left/ and right/ hand)
assets/coin.png         coin icon
assets/mochi-icon.svg   favicon
assets/garden.svg       background illustration
```

## Team

| Person | Role |
|---|---|
| **Cici Zhu** | ML, full-stack development |
| **Rhea Lulla** | ML, data collection |
| **Emily Bae** | Game engineering |
| **Saanvi Prasad** | UI/UX design |

## Honest limitations

- MVP covers fingerspelling and a few whole signs. Real ASL also uses grammar, facial expressions, and classifiers.
- Training data comes from 5 signers, so accuracy on very different hands may be lower.
- This is a practice tool for beginners, not a replacement for Deaf teachers.
