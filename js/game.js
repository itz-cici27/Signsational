import { createHandTracker, startCamera, stopCamera, runLoop, toFeatures, drawHand } from "./hands.js";
import { loadClassifier } from "./classifier.js";
import { LEVELS, HINTS, WORD_SETS, SHOP_ITEMS } from "./letters.js";
import {
  loadSettings, saveSettings, loadProgress, saveProgress, bumpStreak, currentStreak,
  loadShop, saveShop,
} from "./store.js";
import { mascotSVG } from "./mascot.js";

// How sure the model must be, and for how many frames in a row (~30 frames = 1 second).
const STRICTNESS = {
  easy: { conf: 0.55, hold: 8 },
  normal: { conf: 0.7, hold: 12 },
  strict: { conf: 0.85, hold: 18 },
};
const RING = 2 * Math.PI * 54;
const CHEERS = ["You got it!", "Beautiful sign!", "Nailed it!", "So clean!", "Yes! On to the next one."];
const NUDGES = [
  "Take your time. There's no timer.",
  "Try the hint below the letter.",
  "Move your hand a little closer to the camera.",
  "Almost there. Check your thumb position.",
];

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let settings = loadSettings();
let progress = loadProgress();
let shop = loadShop();
let classifier = null;
let modelLoaded = false;
let tracker = null;
let stream = null;
let stopLoop = null;
let aspect = 4 / 3;
let audioCtx = null;
let goingToNextLevel = false;

const play = {
  level: null, queue: [], idx: 0, hold: 0, skipped: new Set(),
  busy: false, letterStart: 0, lastNudge: 0,
  mode: "level", // "level" or "word"
  wordSet: null, wordPos: 0,
};

function renderMascots() {
  document.querySelectorAll("[data-mascot]").forEach((el) => {
    el.innerHTML = mascotSVG(shop.equipped);
  });
}
renderMascots();

// ---------- helpers ----------
const availableLetters = (lv) => (classifier ? lv.letters.filter((l) => classifier.labels.includes(l)) : []);
const isUnlocked = (i) => settings.unlockAll || i === 0 || progress.completed.includes(LEVELS[i - 1].id);
const wordPlayable = (word) => classifier && word.split("").every((l) => classifier.labels.includes(l));

function currentTarget() {
  if (play.mode === "word") return play.queue[play.idx][play.wordPos];
  return play.queue[play.idx];
}

function signPath(letter) {
  return `assets/signs/${settings.leftHanded ? "left" : "right"}/${letter}.jpg`;
}

function setMascot(id, state) {
  const el = $(id);
  el.classList.remove("is-cheer", "is-think");
  if (state) el.classList.add(state);
}

function say(text) {
  $("playBubble").textContent = text;
}

function setRing(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  $("ringFill").style.strokeDashoffset = String(RING * (1 - f));
}

function chime() {
  if (!settings.sound) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const t = audioCtx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const start = t + i * 0.08;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // sound is optional
  }
}

function applySettings() {
  document.documentElement.classList.toggle("big-text", settings.bigText);
}

// ---------- home screen ----------
function renderHome() {
  $("streakCount").textContent = currentStreak(progress);
  $("coinDisplay").textContent = progress.coins || 0;

  const list = $("levels");
  list.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const letters = availableLetters(lv);
    const done = progress.completed.includes(lv.id);
    const unlocked = isUnlocked(i);
    const coins = done ? 10 : 50;
    let status = done ? `${lv.sticker} Done` : unlocked ? "Ready" : "Finish the last level to unlock";
    if (classifier && letters.length === 0) status = "Not trained yet";
    else if (classifier && letters.length < lv.letters.length) status += ` (${letters.length} of ${lv.letters.length} letters trained)`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level" + (done ? " is-done" : "") + (unlocked ? "" : " is-locked");
    btn.disabled = !classifier || !unlocked || letters.length === 0;
    btn.innerHTML = `
      <span class="level-num">${lv.id}</span>
      <span class="level-letters">${lv.letters.join(" ")}</span>
      <span class="level-status">${status}</span>
      <span class="level-coins">\u{1FA99} ${coins}</span>`;
    btn.setAttribute("aria-label", `Level ${lv.id}, letters ${lv.letters.join(", ")}. ${status}`);
    btn.addEventListener("click", () => startLevel(lv));
    const li = document.createElement("li");
    li.append(btn);
    list.append(li);
  });

  renderWordChallenges();

  $("stickerBook").innerHTML = LEVELS.map((lv) => {
    const earned = progress.completed.includes(lv.id);
    return earned
      ? `<li class="sticker earned"><span class="disc" aria-hidden="true">${lv.sticker}</span><span class="cap">${lv.stickerName}</span></li>`
      : `<li class="sticker"><span class="disc" aria-hidden="true">?</span><span class="cap">Level ${lv.id}</span></li>`;
  }).join("");

  renderShop();

  const note = $("modelNote");
  if (!modelLoaded) note.textContent = "Loading the letter model\u2026";
  else if (!classifier) {
    note.innerHTML = 'No letter model yet. Open the <a href="recorder.html">recorder</a>, record a few letters, and they\u2019ll work here right away.';
  } else if (classifier.kind === "mlp") {
    const acc = classifier.info && classifier.info.mean_person_accuracy;
    note.textContent = `Using the trained model: ${classifier.labels.length} letters` +
      (acc ? `, ${Math.round(acc * 100)}% accurate on signers it never trained on.` : ".");
  } else {
    note.innerHTML = `Quick-start mode, using ${classifier.X.length} samples recorded in this browser. Run <code>train.py</code> for the full model.`;
  }

  $("continueBtn").disabled = !classifier;
}

function renderWordChallenges() {
  const list = $("wordLevels");
  list.innerHTML = "";
  const completedCount = progress.completed.length;

  WORD_SETS.forEach((ws) => {
    const playableWords = classifier ? ws.words.filter((w) => wordPlayable(w)) : [];
    const done = (progress.wordsCompleted || []).includes(ws.id);
    const unlocked = completedCount >= 1 && playableWords.length > 0;
    const coins = done ? Math.round(ws.reward / 3) : ws.reward;
    let status = done ? "\u{1FA99} Done" : unlocked ? `${playableWords.length} words` : "Complete a letter level first";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level word-level" + (done ? " is-done" : "") + (unlocked ? "" : " is-locked");
    btn.disabled = !unlocked;
    btn.innerHTML = `
      <span class="level-num wl-reward">\u{1FA99}${coins}</span>
      <span class="level-letters wl-words">${ws.words.join("  ")}</span>
      <span class="level-status">${status}</span>`;
    btn.setAttribute("aria-label", `${ws.name}: ${ws.words.join(", ")}. ${status}`);
    btn.addEventListener("click", () => startWordSet(ws));
    const li = document.createElement("li");
    li.append(btn);
    list.append(li);
  });
}

function renderShop() {
  $("shopCoins").textContent = progress.coins || 0;
  const grid = $("shopGrid");
  grid.innerHTML = SHOP_ITEMS.map((item) => {
    const owned = shop.owned.includes(item.id);
    const equipped = shop.equipped.includes(item.id);
    const canAfford = (progress.coins || 0) >= item.price;

    let actionText, actionClass;
    if (equipped) { actionText = "Unequip"; actionClass = "is-equipped"; }
    else if (owned) { actionText = "Equip"; actionClass = "is-owned"; }
    else if (canAfford) { actionText = `Buy \u00B7 \u{1FA99}${item.price}`; actionClass = ""; }
    else { actionText = `\u{1FA99}${item.price}`; actionClass = "is-expensive"; }

    return `<button class="shop-item ${actionClass}" data-item="${item.id}" ${!owned && !canAfford ? "disabled" : ""}>
      <span class="shop-emoji">${item.emoji}</span>
      <span class="shop-name">${item.name}</span>
      <span class="shop-desc">${item.description}</span>
      <span class="shop-action">${actionText}</span>
    </button>`;
  }).join("");

  grid.querySelectorAll(".shop-item").forEach((btn) => {
    btn.addEventListener("click", () => handleShopClick(btn.dataset.item));
  });
}

function handleShopClick(itemId) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return;

  if (shop.owned.includes(itemId)) {
    // Toggle equip/unequip
    if (shop.equipped.includes(itemId)) {
      shop.equipped = shop.equipped.filter((id) => id !== itemId);
    } else {
      shop.equipped.push(itemId);
    }
    saveShop(shop);
    renderMascots();
    renderShop();
  } else if ((progress.coins || 0) >= item.price) {
    // Buy and auto-equip
    progress.coins -= item.price;
    saveProgress(progress);
    shop.owned.push(itemId);
    shop.equipped.push(itemId);
    saveShop(shop);
    renderMascots();
    renderShop();
    $("coinDisplay").textContent = progress.coins;
  }
}

function nextLevelToPlay() {
  const playable = LEVELS.filter((lv, i) => isUnlocked(i) && availableLetters(lv).length);
  return playable.find((lv) => !progress.completed.includes(lv.id)) || playable[0];
}

function goHome() {
  closeCamera();
  $("play").hidden = true;
  $("home").hidden = false;
  $("wordDisplay").hidden = true;
  play.mode = "level";
  renderHome();
}

// ---------- camera ----------
async function openCamera() {
  const video = $("video");
  try {
    $("camStatus").textContent = "Loading hand tracker";
    if (!tracker) tracker = await createHandTracker();
    $("camStatus").textContent = "Starting camera";
    stream = await startCamera(video);
  } catch (err) {
    console.error(err);
    $("camStatus").textContent =
      err && err.name === "NotAllowedError"
        ? "Camera access is blocked. Allow the camera in your browser's address bar, then reload."
        : "The camera or hand tracker didn't start. Check your internet connection and reload.";
    return;
  }
  if ($("play").hidden) {
    // learner left the level while the camera was starting
    stopCamera(stream);
    stream = null;
    return;
  }
  aspect = video.videoWidth / video.videoHeight || 4 / 3;
  const canvas = $("overlay");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  $("camStatus").textContent = "";
  stopLoop = runLoop(video, tracker, onFrame);
}

function closeCamera() {
  if (stopLoop) stopLoop();
  stopLoop = null;
  stopCamera(stream);
  stream = null;
}

// ---------- playing a level ----------
async function startLevel(lv) {
  play.mode = "level";
  play.level = lv;
  play.queue = availableLetters(lv);
  play.idx = 0;
  play.skipped = new Set();
  $("home").hidden = true;
  $("play").hidden = false;
  $("wordDisplay").hidden = true;
  $("levelLabel").textContent = `Level ${lv.id}`;
  window.scrollTo(0, 0);
  showLetter();
  if (!stream) await openCamera();
}

function showLetter() {
  const letter = play.queue[play.idx];
  play.hold = 0;
  play.busy = false;
  play.letterStart = performance.now();
  play.lastNudge = performance.now();

  $("targetLetter").textContent = letter;
  $("letterCount").textContent = `${play.idx + 1} of ${play.queue.length}`;
  $("hint").textContent = HINTS[letter] || "";
  $("seeing").textContent = "";

  // Optional reference photo: assets/signs/A.jpg, B.jpg, ...
  const img = $("signImg");
  $("signRef").hidden = true;
  img.onload = () => ($("signRef").hidden = false);
  img.onerror = () => ($("signRef").hidden = true);
  img.alt = `Reference photo of the ASL letter ${letter}`;
  img.src = signPath(letter);

  setRing(0);
  setMascot("playMascot", "");
  say(`Show me the letter ${letter}.`);
}

// ---------- word challenges ----------
async function startWordSet(ws) {
  play.mode = "word";
  play.wordSet = ws;
  play.queue = ws.words.filter((w) => wordPlayable(w));
  play.idx = 0;
  play.wordPos = 0;
  play.skipped = new Set();
  $("home").hidden = true;
  $("play").hidden = false;
  $("wordDisplay").hidden = false;
  $("levelLabel").textContent = ws.name;
  window.scrollTo(0, 0);
  showWord();
  if (!stream) await openCamera();
}

function showWord() {
  const word = play.queue[play.idx];
  play.wordPos = 0;
  play.hold = 0;
  play.busy = false;
  $("letterCount").textContent = `Word ${play.idx + 1} of ${play.queue.length}`;
  renderWordDisplay(word, 0);
  showWordLetter();
}

function renderWordDisplay(word, pos) {
  const wd = $("wordDisplay");
  wd.innerHTML = word.split("").map((l, i) => {
    let cls = "word-letter";
    if (i < pos) cls += " is-done";
    else if (i === pos) cls += " is-current";
    return `<span class="${cls}">${l}</span>`;
  }).join("");
}

function showWordLetter() {
  const word = play.queue[play.idx];
  const letter = word[play.wordPos];
  play.hold = 0;
  play.busy = false;
  play.letterStart = performance.now();
  play.lastNudge = performance.now();

  $("targetLetter").textContent = letter;
  $("hint").textContent = HINTS[letter] || "";
  $("seeing").textContent = "";
  renderWordDisplay(word, play.wordPos);

  const img = $("signImg");
  $("signRef").hidden = true;
  img.onload = () => ($("signRef").hidden = false);
  img.onerror = () => ($("signRef").hidden = true);
  img.alt = `Reference photo of the ASL letter ${letter}`;
  img.src = `assets/signs/${letter}.jpg`;

  setRing(0);
  setMascot("playMascot", "");
  say(`Spell "${word}" \u2014 show me ${letter}.`);
}

function advanceWord() {
  play.wordPos += 1;
  const word = play.queue[play.idx];
  if (play.wordPos >= word.length) {
    play.idx += 1;
    if (play.idx >= play.queue.length) {
      finishWordSet();
    } else {
      showWord();
    }
  } else {
    showWordLetter();
  }
}

function finishWordSet() {
  play.busy = true;
  closeCamera();
  const ws = play.wordSet;
  const firstTime = !(progress.wordsCompleted || []).includes(ws.id);
  const coins = firstTime ? ws.reward : Math.round(ws.reward / 3);

  if (firstTime) {
    if (!progress.wordsCompleted) progress.wordsCompleted = [];
    progress.wordsCompleted.push(ws.id);
  }
  progress.coins = (progress.coins || 0) + coins;
  saveProgress(progress);

  $("bigSticker").textContent = "\u{1FA99}";
  $("celebrateTitle").textContent = `${ws.name} complete!`;
  $("celebrateText").textContent = firstTime
    ? "Great spelling! Those coins are yours."
    : "Nice practice run!";
  $("coinReward").textContent = `+${coins} coins`;
  $("coinReward").hidden = false;
  $("nextLevelBtn").hidden = true;
  confetti();
  $("celebrate").showModal();
}

// ---------- game loop ----------
function onFrame(lm) {
  const canvas = $("overlay");
  drawHand(canvas.getContext("2d"), lm, canvas.width, canvas.height);
  if ($("play").hidden || play.busy || !classifier) return;

  const target = currentTarget();
  const rule = STRICTNESS[settings.strictness] || STRICTNESS.normal;

  if (!lm) {
    $("seeing").textContent = "I can't see a hand yet. Hold it up inside the frame.";
    play.hold = Math.max(0, play.hold - 1);
    setRing(play.hold / rule.hold);
    return;
  }

  const { label, conf } = classifier.predict(toFeatures(lm, aspect, settings.leftHanded));
  $("seeing").textContent =
    label === target ? `That looks like ${label}. Hold it!` : `Right now that looks like ${label}.`;

  if (label === target && conf >= rule.conf) play.hold += 1;
  else play.hold = Math.max(0, play.hold - 2);
  setRing(play.hold / rule.hold);

  if (play.hold >= rule.hold) {
    success();
    return;
  }

  const now = performance.now();
  if (now - play.letterStart > 12000 && now - play.lastNudge > 9000) {
    play.lastNudge = now;
    say(pick(NUDGES));
    setMascot("playMascot", "is-think");
  }
}

function success() {
  play.busy = true;
  setRing(1);
  $("target").classList.add("is-hit");
  setMascot("playMascot", "is-cheer");
  say(pick(CHEERS));
  chime();
  progress = bumpStreak(progress);
  saveProgress(progress);
  $("streakCount").textContent = currentStreak(progress);
  setTimeout(() => {
    $("target").classList.remove("is-hit");
    if (play.mode === "word") advanceWord();
    else advance();
  }, 1100);
}

function advance() {
  play.idx += 1;
  if (play.idx >= play.queue.length) finishLevel();
  else showLetter();
}

function skipLetter() {
  if (play.busy) return;
  if (play.mode === "word") {
    const word = play.queue[play.idx];
    if (!play.skipped.has(word)) {
      play.skipped.add(word);
      play.queue.push(word);
    }
    play.idx += 1;
    if (play.idx >= play.queue.length) finishWordSet();
    else showWord();
  } else {
    const letter = play.queue[play.idx];
    if (!play.skipped.has(letter)) {
      play.skipped.add(letter);
      play.queue.push(letter);
    }
    advance();
  }
}

function finishLevel() {
  play.busy = true;
  closeCamera();
  const lv = play.level;
  const firstTime = !progress.completed.includes(lv.id);
  const coins = firstTime ? 50 : 10;

  if (firstTime) progress.completed.push(lv.id);
  progress.coins = (progress.coins || 0) + coins;
  saveProgress(progress);

  $("bigSticker").textContent = lv.sticker;
  $("celebrateTitle").textContent = firstTime ? `You earned the ${lv.stickerName} sticker!` : `Level ${lv.id} complete!`;
  $("celebrateText").textContent = firstTime
    ? "It's in your sticker book now."
    : "Nice review. Practice keeps the handshapes fresh.";
  $("coinReward").textContent = `+${coins} coins`;
  $("coinReward").hidden = false;

  const next = LEVELS[LEVELS.indexOf(lv) + 1];
  $("nextLevelBtn").hidden = !(next && availableLetters(next).length);
  confetti();
  $("celebrate").showModal();
}

function confetti() {
  const box = $("confetti");
  box.innerHTML = "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bits = play.mode === "word"
    ? ["\u2728", "\uD83D\uDC9C", "\uD83D\uDC9B", "\u{1FA99}", "\u{1FA99}"]
    : ["\u2728", "\uD83D\uDC9C", "\uD83D\uDC9B", "\uD83C\uDF38", play.level.sticker];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span");
    s.textContent = pick(bits);
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    s.style.fontSize = `${1 + Math.random()}rem`;
    box.append(s);
  }
}

// ---------- settings ----------
function openSettings() {
  $("setLeft").checked = settings.leftHanded;
  $("setBig").checked = settings.bigText;
  $("setSound").checked = settings.sound;
  $("setUnlock").checked = settings.unlockAll;
  document.querySelectorAll('input[name="strict"]').forEach((r) => (r.checked = r.value === settings.strictness));
  $("settings").showModal();
}

function updateSettings() {
  settings = {
    ...settings,
    leftHanded: $("setLeft").checked,
    bigText: $("setBig").checked,
    sound: $("setSound").checked,
    unlockAll: $("setUnlock").checked,
    strictness: document.querySelector('input[name="strict"]:checked')?.value || "normal",
  };
  saveSettings(settings);
  applySettings();
  const current = play.queue[play.idx];
  if (!$("play").hidden && current) $("signImg").src = signPath(current);
  if (!$("home").hidden) renderHome();
}

// ---------- wiring ----------
$("continueBtn").addEventListener("click", () => {
  const lv = nextLevelToPlay();
  if (lv) startLevel(lv);
});
$("backBtn").addEventListener("click", goHome);
$("skipBtn").addEventListener("click", skipLetter);
$("settingsBtn").addEventListener("click", openSettings);
$("settingsDone").addEventListener("click", () => $("settings").close());
$("settings").addEventListener("change", updateSettings);

$("nextLevelBtn").addEventListener("click", () => {
  goingToNextLevel = true;
  $("celebrate").close();
  const next = LEVELS[LEVELS.indexOf(play.level) + 1];
  startLevel(next);
});
$("toLevelsBtn").addEventListener("click", () => $("celebrate").close());
$("celebrate").addEventListener("close", () => {
  $("coinReward").hidden = true;
  if (!goingToNextLevel) goHome();
  goingToNextLevel = false;
});

(async function init() {
  applySettings();
  renderHome();
  classifier = await loadClassifier();
  modelLoaded = true;
  renderHome();
})();
