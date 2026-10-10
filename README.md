# Signsational 🤟

A free, browser-based game for learning the ASL fingerspelling alphabet. Your webcam
tracks your hand, a neural network we trained checks your handshape, and Mochi the
mascot cheers you on. Levels, daily streaks, and a sticker book keep you coming back.

Built for Code Ada 2026, **Tech for Equity** track.

## Why it matters

Most deaf children are born to hearing parents, and many of those families never become
fluent signers. ASL classes cost money and time, and free apps mostly offer videos with no
feedback on whether you're signing correctly. Sign Language Snap gives anyone with a
webcam real-time feedback for free, so the hearing people around a Deaf person can share
the work of communicating.

## How it works

1. **Hand tracking.** MediaPipe Hand Landmarker finds 21 points on your hand, in the browser.
   Video never leaves the device.
2. **Features.** The 21 points are centered on the wrist and scaled by palm size (63 numbers),
   so position and distance from the camera don't matter. Left-handed signers are mirrored.
3. **Classifier.** A small neural network (63 inputs, 64 hidden units, 1 output per letter)
   trained by `train.py` on data our team recorded. It runs in plain JavaScript.
4. **Game logic.** A letter counts when the model is confident for about half a second in a
   row, which stops flickers from passing.

## Run it locally

The pages use JavaScript modules, so open them through a local server, not by double-clicking:

```bash
cd sign-language-snap
python3 -m http.server 8000
```

Then open <http://localhost:8000> (game) or <http://localhost:8000/recorder.html> (recorder).
Webcams work on `localhost` and on any `https://` site. You need internet for the
MediaPipe files and fonts.

## Data and training workflow

1. Everyone opens `recorder.html`, enters their name, and records **two takes of every
   letter** (one close, one farther and slightly tilted). About 15 minutes per person.
2. As soon as you record, the game works in **quick-start mode** using the samples saved in
   that browser. Good for testing tonight.
3. Each person clicks **Download CSV** and sends the file to the ML lead, who puts every
   CSV in `data/`.
4. ML lead runs:
   ```bash
   pip install -r requirements.txt
   python train.py
   ```
   This prints accuracy tested on each person the model never trained on, lists the
   letters it mixes up, saves `model/confusion_matrix.png`, and writes `model/model.json`.
5. Commit `model/model.json`. The game loads it automatically and switches from quick-start
   mode to the trained model.
6. Record extra takes of the weakest letters, retrain, repeat.

## Project structure

```
index.html            game: levels, streaks, stickers
recorder.html         team tool for recording training data
css/style.css         all styles
js/hands.js           MediaPipe setup, camera, feature extraction, drawing
js/classifier.js      trained network (MLP) + quick-start kNN fallback
js/game.js            game logic
js/recorder.js        data collection and CSV import/export
js/letters.js         letters, levels, stickers, handshape hints
js/mascot.js          Mochi SVG
train.py              training + honest evaluation + export
data/                 recorded CSVs go here
model/                model.json and confusion_matrix.png land here
assets/signs/         optional reference photos (A.jpg, B.jpg, ...)
```

## Deploy (GitHub Pages)

1. Push the repo to GitHub.
2. Settings, then Pages, then deploy from the `main` branch, root folder.
3. Your site will be at `https://<username>.github.io/<repo>/`. Test it on a phone.

---

# Team plan: 4 people, under 24 hours

Everyone gets the starter code running tonight. After that, each person owns one area.
Pair up whenever someone is blocked.

## Roles

| Person | Owns | Done when |
|---|---|---|
| **ML engineers: Cici Zhu & Rhea Lulla** | Data collection, `train.py`, accuracy numbers, confusion matrix | `model.json` covers all 24 letters with a held-out accuracy number you can quote |
| **Game engineer: Emily Bae** | `game.js`, `hands.js`, tuning strictness, testing on every laptop | A stranger can finish Level 1 without help |
| **UI/UX Designer: Saanvi Prasad** | Mochi, stickers, reference photos, accessibility polish, `style.css` | Every screen looks finished and passes the accessibility checklist below |
| **Everyone: pitch and deploy** | GitHub repo, deployment, submission, pitch deck and script, backup demo video | Site is live, submitted early, and the pitch is rehearsed |

## Timeline

### Friday night (after dinner, about 7 to 10 PM)
- **Everyone (30 min):** Clone the repo, run it locally, and record two takes of every letter in the recorder. Send your CSV to P1.
- **ML engineers:** Run `train.py` on the first batch and commit `model.json`. Write down the first accuracy number.
- **Game engineer:** Check that tracking works on all four laptops. Play Level 1 with the first model and note which letters feel too hard or too easy.
- **UI/UX Designer:** Take reference photos of all 24 letters (one hand, plain background) and save them as `assets/signs/A.jpg` and so on.
- **Everyone:** Create the GitHub repo, deploy to GitHub Pages, and share the link in your team chat. Start the submission draft.
- **Sleep.** Seriously.

### Saturday
| Time | P1: ML | P2: Game | P3: Design | P4: PM |
|---|---|---|---|---|
| 9:30 to 10:30 | Workshop 2 (everyone, required) | | | |
| 10:30 to 12 | Record extra takes of the weakest letters, retrain | Tune strictness levels with the real model | Polish Mochi states and sticker art | Draft the pitch: problem, user story, demo flow |
| 12 to 1 | Lunch | | | |
| 1 to 2 | **PM check-in (required):** demo the current build, pick at most 2 stretch goals | | | |
| 2 to 3 | Workshop 3: Hosting (everyone, required) | | | |
| 3:30 to 5 | Final retrain, save confusion matrix for slides | Build stretch goal 1 | Accessibility pass (checklist below) | Build slides, collect stats and sources |
| 5 to 6:30 | Social event (take the break) | | | |
| 8 to 9:30 | Help test, write "How it works" in this README | Bug fixes only | Screenshots for the submission | Record a backup demo video |
| **9:30** | **Feature freeze.** Only bug fixes after this. | | | |
| By 11 PM | **Submit.** Leave an hour of buffer before midnight. | | | |

### Sunday
- **9 to 10 AM:** Rehearse the pitch twice, with a timer. Test the demo laptop in the presentation room's lighting.
- **10 AM:** Present.

## Stretch goals (pick at most 2 at the check-in)
- **Spell your name:** type a name and fingerspell it letter by letter. Great live demo.
- **Word mode:** short words (CAB, BED, FIG) using only trained letters.
- **Practice stats:** a page showing which letters take you the longest.
- **Motion letters J and Z:** record short landmark sequences. Only if everything else is done.

## Accessibility checklist (judging criterion)
- [ ] Works with only a keyboard (Tab through every screen)
- [ ] Nothing depends on sound (chime is off by default and always paired with visuals)
- [ ] Larger text setting works on every screen
- [ ] Left-handed mode mirrors both recognition and the reference photo
- [ ] Runs on the slowest laptop on the team and on a phone
- [ ] "Video never leaves this device" is visible on the home screen
- [ ] Error messages explain what to do (try denying camera access to check)

## Pitch outline (2 to 3 minutes, about 30 seconds each)
1. **The problem.** Hearing families of deaf kids, cost of classes, no feedback in free apps.
2. **Live demo.** Sign 3 letters, Mochi cheers, finish a level, the sticker slaps in.
3. **How it works.** Landmarks, our trained network, held-out accuracy, confusion matrix.
4. **Inclusive design.** Left-hand mode, no sound needed, runs on cheap hardware, private.
5. **What's next.** Motion signs, and building the curriculum with Deaf educators.

## Honest limitations (say these in the pitch, judges respect it)
- MVP covers static fingerspelling only. Real ASL also uses movement and facial expressions.
- Training data comes from four signers, so accuracy on very different hands may be lower.
- This is a practice tool for beginners, not a replacement for Deaf teachers.
