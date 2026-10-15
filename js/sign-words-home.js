// "Sign Words" section on the home page (index.html): one folder per topic.
// Each card opens signs.html.
import { SIGN_WORDS, SIGN_TOPICS, loadSignClassifier, signRewards, isTrial, TRIAL_TAG } from "./signs.js";
import { loadProgress } from "./store.js";

const $ = (id) => document.getElementById(id);

function signCard(s, classifier, done) {
  const trained = !!classifier && classifier.labels.includes(s.word);
  const isDone = done.includes(s.word);
  const status = !classifier ? "Loading…" : !trained ? "Not trained yet" : isDone ? "Learned" : "Ready";
  const trial = trained && isTrial(classifier, s.word);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "level sign-card" + (isDone ? " is-done" : "") + (trained ? "" : " is-locked");
  btn.disabled = !trained;
  btn.innerHTML = `
    <span class="level-letters">${s.word}</span>
    <span class="level-status">${status}${trial ? " " + TRIAL_TAG : ""}</span>
    <span class="level-coins"><img class="coin-icon" src="assets/coin.png" alt="coins" aria-hidden="true"> ${signRewards(isDone)}</span>`;
  btn.setAttribute("aria-label", `Sign the word ${s.word}. ${status}${trial ? ". Trial" : ""}`);
  btn.addEventListener("click", () => (location.href = `signs.html?word=${encodeURIComponent(s.word)}`));
  const li = document.createElement("li");
  li.append(btn);
  return li;
}

function render(classifier) {
  const done = loadProgress().signsCompleted || [];
  const box = $("signWords");
  const openTopic = box.querySelector("details[open]")?.dataset.topic; // stay open across re-renders
  box.innerHTML = "";

  for (const topic of SIGN_TOPICS) {
    const signs = SIGN_WORDS.filter((s) => s.topic === topic.id);
    if (!signs.length) continue;
    // Counts every word in the folder, trained or not.
    const learned = signs.filter((s) => done.includes(s.word)).length;
    const count = `${learned} of ${signs.length} learned`;
    // Peek at the first few words, as many as fit on one line.
    let chars = 0;
    const peek = signs.filter((s) => (chars += s.word.length + 3) <= 16);
    const preview = peek.map((s) => `<span class="folder-chip">${s.word}</span>`).join("") +
      (signs.length > peek.length ? `<span class="folder-chip is-more">+${signs.length - peek.length}</span>` : "");

    const folder = document.createElement("details");
    folder.className = `sign-folder folder-${topic.id}`;
    folder.dataset.topic = topic.id;
    folder.open = topic.id === openTopic;
    folder.innerHTML = `
      <summary>
        <span class="folder-tab" aria-hidden="true"></span>
        <span class="folder-head">
          <span class="folder-name">${topic.name}</span>
          <span class="folder-count">${count}</span>
        </span>
        <span class="folder-bar" aria-hidden="true"><span style="width:${(learned / signs.length) * 100}%"></span></span>
        <span class="folder-chips" aria-hidden="true">${preview}</span>
      </summary>`;
    const list = document.createElement("ol");
    list.className = "levels folder-cards";
    signs.forEach((s) => list.append(signCard(s, classifier, done)));
    folder.append(list);
    // One folder open at a time, like flipping between folders. An opened folder moves to
    // the top of Sign Words (CSS order), and the page scrolls there, but only when the
    // player opened it, not when the cards re-render.
    let clicked = false;
    folder.querySelector("summary").addEventListener("click", () => (clicked = true));
    folder.addEventListener("toggle", () => {
      if (!folder.open) return;
      box.querySelectorAll("details[open]").forEach((d) => d !== folder && (d.open = false));
      if (clicked) {
        const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
        $("signWordsTitle").scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      }
      clicked = false;
    });
    box.append(folder);
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
