// "Sign Words" section on the home page (index.html). Each card opens signs.html.
import { SIGN_WORDS, loadSignClassifier, signRewards } from "./signs.js";
import { loadProgress } from "./store.js";

const $ = (id) => document.getElementById(id);

function render(classifier) {
  const done = loadProgress().signsCompleted || [];
  const list = $("signWords");
  list.innerHTML = "";
  for (const s of SIGN_WORDS) {
    const trained = !!classifier && classifier.labels.includes(s.word);
    const isDone = done.includes(s.word);
    const status = !classifier ? "Loading…" : !trained ? "Not trained yet" : isDone ? "Learned" : "Ready";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level sign-card" + (isDone ? " is-done" : "") + (trained ? "" : " is-locked");
    btn.disabled = !trained;
    btn.innerHTML = `
      <span class="level-letters">${s.word}</span>
      <span class="level-status">${status}</span>
      <span class="level-coins"><img class="coin-icon" src="assets/coin.png" alt="coins" aria-hidden="true"> ${signRewards(isDone)}</span>`;
    btn.setAttribute("aria-label", `Sign the word ${s.word}. ${status}`);
    btn.addEventListener("click", () => (location.href = `signs.html?word=${encodeURIComponent(s.word)}`));
    const li = document.createElement("li");
    li.append(btn);
    list.append(li);
  }
}

(async function init() {
  render(null);
  const classifier = await loadSignClassifier();
  render(classifier || { labels: [] });
  const note = $("signNote");
  if (!classifier) {
    note.innerHTML = 'No word model yet. Record signs in the <a href="words-recorder.html">word recorder</a>, then run <code>python train_words.py</code>.';
  } else if (classifier.kind === "knn") {
    note.innerHTML = `Quick-start mode, using ${classifier.X.length} word clips recorded in this browser. Run <code>train_words.py</code> for the full model.`;
  }
})();
