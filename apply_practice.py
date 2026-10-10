import os
import re

def apply_smart_review():
    game_path = os.path.join("js", "game.js")
    
    # Locate CSS file
    css_path = None
    for candidate in [os.path.join("css", "style.css"), os.path.join("css", "main.css")]:
        if os.path.exists(candidate):
            css_path = candidate
            break

    if not os.path.exists(game_path):
        print(f"Error: Could not find {game_path}")
        return

    with open(game_path, "r", encoding="utf-8") as f:
        game_code = f.read()

    # 1. Add recordLetterStat function if missing
    if "function recordLetterStat" not in game_code:
        stat_func = """
// ---------- smart review & practice stats ----------
function recordLetterStat(letter, skipped = false) {
  if (!letter) return;
  if (!progress.stats) progress.stats = {};
  if (!progress.stats[letter]) {
    progress.stats[letter] = { attempts: 0, totalTime: 0, avgTime: 0, skips: 0, score: 0 };
  }

  const s = progress.stats[letter];
  s.attempts += 1;

  if (skipped) {
    s.skips += 1;
  } else {
    const elapsed = Math.max(0.5, (performance.now() - play.letterStart) / 1000);
    s.totalTime += elapsed;
    s.avgTime = s.totalTime / Math.max(1, s.attempts - s.skips);
  }

  s.score = (s.avgTime || 5) + (s.skips * 8);
  persistProgress();
}
"""
        game_code += "\n" + stat_func
        print("Added recordLetterStat tracker.")

    # 2. Hook tracker inside success()
    if "recordLetterStat(currentTarget(), false);" not in game_code:
        game_code = game_code.replace(
            "function success() {",
            "function success() {\n  recordLetterStat(currentTarget(), false);"
        )
        print("Hooked stats tracking into success().")

    # 3. Hook tracker inside skipLetter()
    if "recordLetterStat(currentTarget(), true);" not in game_code:
        game_code = game_code.replace(
            "function skipLetter() {",
            "function skipLetter() {\n  recordLetterStat(currentTarget(), true);"
        )
        print("Hooked stats tracking into skipLetter().")

    # 4. Replace signPath to maintain right/left logic
    signpath_pattern = r"function signPath\(letter\)\s*\{[^}]*\}"
    new_signpath = """function signPath(letter) {
  return `assets/signs/${settings.leftHanded ? "right" : "left"}/${letter}.jpg`;
}"""
    game_code = re.sub(signpath_pattern, lambda m: new_signpath, game_code)

    # 5. Replace renderHome with "Needs Practice" badges
    render_home_pattern = r"function renderHome\(\)\s*\{[\s\S]*?\n\}"
    new_render_home = """function renderHome() {
  const stats = progress.stats || {};

  $("stickerBook").innerHTML = ALL_LETTERS.filter(letterDone).length > 0
    ? ALL_LETTERS.filter(letterDone).map(l => {
        const needsPractice = (stats[l]?.score || 0) > 8 || (stats[l]?.skips || 0) > 0;
        const badge = needsPractice ? `<span class="needs-practice-tag">Needs Practice</span>` : "";
        return `<li class="sticker earned">
                  <span class="disc" aria-hidden="true">${l}</span>
                  <span class="cap">${l}</span>
                  ${badge}
                </li>`;
      }).join("")
    : '<li class="sticker"><span class="disc" aria-hidden="true">?</span><span class="cap">Complete letters to collect!</span></li>';

  const note = $("modelNote");
  if (!modelLoaded) note.textContent = "Loading the letter model\\u2026";
  else if (!classifier) {
    note.innerHTML = 'No letter model yet. Open the <a href="recorder.html">recorder</a>, record a few letters, and they\\u2019ll work here right away.';
  } else if (classifier.kind === "mlp") {
    const acc = classifier.info && classifier.info.mean_person_accuracy;
    note.textContent = `Using the trained model: ${classifier.labels.length} letters` +
      (acc ? `, ${Math.round(acc * 100)}% accurate on signers it never trained on.` : ".");
  } else {
    note.innerHTML = `Quick-start mode, using ${classifier.X.length} samples recorded in this browser. Run <code>train.py</code> for the full model.`;
  }

  $("continueBtn").disabled = !classifier;
}"""
    game_code = re.sub(render_home_pattern, lambda m: new_render_home, game_code)

    # 6. Replace renderReview with Spaced Repetition sorting & timing stats
    render_review_pattern = r"function renderReview\(\)\s*\{[\s\S]*?\n\}"
    new_render_review = """function renderReview() {
  const completed = progress.lettersCompleted || [];
  const reviewGrid = $("reviewLetters");
  const stats = progress.stats || {};

  if (completed.length === 0) {
    reviewGrid.innerHTML = '<p class="empty-state">No letters completed yet. Head to the Letters tab to start!</p>';
  } else {
    reviewGrid.innerHTML = "";
    completed.sort((a, b) => (stats[b]?.score || 0) - (stats[a]?.score || 0));

    completed.forEach(letter => {
      const s = stats[letter] || { avgTime: 0, skips: 0, score: 0 };
      const avgSec = s.avgTime ? `${s.avgTime.toFixed(1)}s avg` : "New";
      const needsPractice = s.score > 8 || s.skips > 0;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "letter-card is-done" + (needsPractice ? " needs-practice" : "");
      btn.innerHTML = `
        <span class="letter-card-letter">${letter}</span>
        <span class="letter-card-status">${avgSec} ${s.skips ? `(${s.skips} skips)` : ""}</span>
        <span class="letter-card-coins">${needsPractice ? "⚠️ Needs Practice" : `${COIN}${LETTER_COINS_REPLAY}`}</span>`;
      btn.addEventListener("click", () => { returnTab = "review"; startSingleLetter(letter); });
      reviewGrid.append(btn);
    });
  }

  const wordsDone = progress.wordsCompleted || [];
  const reviewWordsList = $("reviewWords");
  if (wordsDone.length === 0) {
    reviewWordsList.innerHTML = '<li class="empty-state">No word sets completed yet.</li>';
  } else {
    reviewWordsList.innerHTML = "";
    WORD_SETS.filter(ws => wordsDone.includes(ws.id)).forEach(ws => {
      const coins = Math.round(ws.reward / 3);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level word-level is-done";
      btn.innerHTML = `
        <span class="level-num wl-reward">${COIN}${coins}</span>
        <span class="level-letters wl-words">${ws.words.join("  ")}</span>
        <span class="level-status">Review</span>`;
      btn.addEventListener("click", () => { returnTab = "review"; startWordSet(ws); });
      const li = document.createElement("li");
      li.append(btn);
      reviewWordsList.append(li);
    });
  }
}"""
    game_code = re.sub(render_review_pattern, lambda m: new_render_review, game_code)

    # Save updated js/game.js
    with open(game_path, "w", encoding="utf-8") as f:
        f.write(game_code)
    print("Successfully updated js/game.js")

    # 7. Add Badge CSS Rules
    if css_path:
        with open(css_path, "r", encoding="utf-8") as f:
            css_code = f.read()

        if ".needs-practice-tag" not in css_code:
            badge_css = """
/* Practice Stats & Badges */
.needs-practice-tag {
  display: block;
  font-size: 0.65rem;
  background: #ff5252;
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 8px;
  margin-top: 4px;
  font-weight: bold;
}

.letter-card.needs-practice {
  border: 2px solid #ff5252;
}
"""
            css_code += "\n" + badge_css
            with open(css_path, "w", encoding="utf-8") as f:
                f.write(css_code)
            print(f"Successfully added CSS badge styles to {css_path}")

if __name__ == "__main__":
    apply_smart_review()