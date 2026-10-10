import { createHandTracker, startCamera, stopCamera, runLoop, toFeatures, drawHand } from "./hands.js";
import { loadClassifier } from "./classifier.js";
import { LETTERS, HINTS, WORD_SETS, SHOP_ITEMS, MOTION_LETTERS } from "./letters.js";
import { NONE, SignBuffer, loadSignClassifier } from "./signs.js";
import {
  loadSettings, saveSettings, loadProgress, saveProgress, bumpStreak, currentStreak,
  loadShop, saveShop,
} from "./store.js";
import { mascotSVG, applyFlavor } from "./mascot.js";
import { signIn, signOutUser, onAuthChange, currentUser, saveToCloud, loadFromCloud } from "./firebase.js";

const COIN = `<img class="coin-icon" src="assets/coin.png" alt="coins" aria-hidden="true">`;
const ALL_LETTERS = [...LETTERS, ...MOTION_LETTERS].sort();

// How sure the model must be, and for how many frames in a row (~30 frames = 1 second).
const STRICTNESS = {
  easy: { conf: 0.55, hold: 8 },
  normal: { conf: 0.7, hold: 12 },
  strict: { conf: 0.85, hold: 18 },
};
// J and Z use the clip model, checked every PREDICT_EVERY frames (~10 checks per second),
// so "hold" counts checks rather than frames. Same values as the word signs.
const MOTION_STRICTNESS = {
  easy: { conf: 0.5, hold: 3 },
  normal: { conf: 0.6, hold: 4 },
  strict: { conf: 0.75, hold: 6 },
};
const PREDICT_EVERY = 3;
const RING = 2 * Math.PI * 54;
const CHEERS = [
  "Good job!", "You got it!", "Beautiful sign!", "Nailed it!", "So clean!",
  "Yes! On to the next one.", "Wow, you're a natural!", "Mochi is so proud of you!",
];
// The model is starting to see the target letter.
const CLOSE = [
  "Ooh, that's really close!", "So close! Keep going.", "You're right there!",
  "Almost! Just a tiny tweak.", "Getting warmer!",
];
// The ring is more than half full: they just need to hold still.
const HOLDING = ["Yes! Hold it right there…", "That's it, keep holding!", "Looking great, stay still!"];
// Same, for J and Z: they need to keep drawing the letter.
const DRAWING = ["Yes! Draw it again…", "That's it, keep going!", "Looking great, one more time!"];
const NUDGES = [
  "Good try! Take your time. There's no timer.",
  "Nice effort! Peek at the hint below the letter.",
  "Try moving your hand a little closer to the camera.",
  "You're learning! Check where your thumb is.",
  "Every try counts. You've got this!",
];
const SKIPS = ["No worries! We'll come back to it.", "Good call. We'll try that one again later."];

// Mochi's mood -> mascot class. Speech changes at most every MOOD_GAP ms so it doesn't flicker.
const MOOD_CLASS = { idle: "", close: "is-close", holding: "is-close", nudge: "is-think", cheer: "is-cheer" };
const MOOD_GAP = 1500;
// Minimum belief in the target letter that counts as "close", even if another letter is winning.
const CLOSE_CONF = 0.3;

// Coin rewards
const LETTER_COINS_FIRST = 10;
const LETTER_COINS_REPLAY = 2;

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let settings = loadSettings();
let progress = loadProgress();
let shop = loadShop();
let classifier = null;
let signClassifier = null; // clip model for J and Z (model/words.json)
const signBuffer = new SignBuffer();
let frameNo = 0;
let modelLoaded = false;
let tracker = null;
let stream = null;
let stopLoop = null;
let aspect = 4 / 3;
let audioCtx = null;
let activeTab = "home";
let returnTab = "home";

const play = {
  level: null, queue: [], idx: 0, hold: 0, skipped: new Set(),
  busy: false, letterStart: 0, lastNudge: 0,
  mode: "letter", // "letter" or "word"
  wordSet: null, wordPos: 0,
  mood: "idle", moodAt: 0, lastClose: 0,
};

// The Flavor tab in the top bar (js/flavor-menu.js) saves the pick; keep our copy in step
// so later saves don't overwrite it, and sync it to the cloud.
window.addEventListener("mochi:flavor", (e) => {
  shop.flavor = e.detail;
  persistShop();
});

function renderMascots() {
  applyFlavor(shop.flavor);
  document.querySelectorAll("[data-mascot]").forEach((el) => {
    el.innerHTML = mascotSVG(shop.equipped);
  });
}
renderMascots();

// ---------- helpers ----------
const isMotion = (l) => MOTION_LETTERS.includes(l);
// Whether the right model has been trained on this letter.
const knows = (l) => (isMotion(l) ? !!signClassifier && signClassifier.labels.includes(l) : classifier && classifier.labels.includes(l));
const wordPlayable = (word) => classifier && word.split("").every(knows);
const letterDone = (l) => (progress.lettersCompleted || []).includes(l);

// Unlock: first 5 letters free, then unlock next 5 after completing 3 from the previous group.
function letterUnlocked(letter) {
  if (settings.unlockAll) return true;
  const idx = ALL_LETTERS.indexOf(letter);
  if (idx < 5) return true;
  const groupStart = Math.floor(idx / 5) * 5;
  const prevGroupStart = groupStart - 5;
  const prevGroup = ALL_LETTERS.slice(prevGroupStart, groupStart);
  const completedInPrev = prevGroup.filter(l => letterDone(l)).length;
  return completedInPrev >= 3;
}

function currentTarget() {
  if (play.mode === "word") return play.queue[play.idx][play.wordPos];
  return play.queue[play.idx];
}

function signPath(letter) {
  return `assets/signs/${settings.leftHanded ? "right" : "left"}/${letter}.jpg`;
}

function setMascot(id, state) {
  const el = $(id);
  el.classList.remove("is-cheer", "is-think", "is-close");
  if (state) el.classList.add(state);
}

function say(text) {
  const bubble = $("playBubble");
  bubble.textContent = text;
  bubble.classList.remove("is-pop");
  void bubble.offsetWidth; // restart the pop animation
  bubble.classList.add("is-pop");
}

// Change Mochi's mood (face + speech bubble). `force` skips the anti-flicker delay.
function setMood(mood, lines, force = false) {
  const now = performance.now();
  if (mood === play.mood && !force) return;
  if (!force && now - play.moodAt < MOOD_GAP) return;
  play.mood = mood;
  play.moodAt = now;
  setMascot("playMascot", MOOD_CLASS[mood]);
  if (lines) say(typeof lines === "string" ? lines : pick(lines));
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

// ---------- tabs ----------
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach(p => p.hidden = p.id !== `tab-${tab}`);
  $("play").hidden = true;
  closeCamera();
  renderTab(tab);
}

function renderTab(tab) {
  $("streakCount").textContent = currentStreak(progress);
  $("coinDisplay").textContent = progress.coins || 0;
  if (tab === "home") renderHome();
  else if (tab === "letters") renderLetters();
  else if (tab === "words") renderWords();
  else if (tab === "review") renderReview();
  else if (tab === "shop") renderShop();
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ---------- cloud sync ----------
function syncToCloud() {
  if (currentUser()) saveToCloud(progress, shop);
}

function persistProgress() {
  saveProgress(progress);
  syncToCloud();
}

function persistShop() {
  saveShop(shop);
  syncToCloud();
}

function mergeProgress(local, cloud) {
  if (!cloud) return local;
  return {
    completed: [...new Set([...local.completed, ...(cloud.completed || [])])],
    lettersCompleted: [...new Set([...(local.lettersCompleted || []), ...(cloud.lettersCompleted || [])])],
    wordsCompleted: [...new Set([...(local.wordsCompleted || []), ...(cloud.wordsCompleted || [])])],
    coins: Math.max(local.coins || 0, cloud.coins || 0),
    streak: (local.lastDay || "") >= (cloud.lastDay || "") ? local.streak : cloud.streak,
    lastDay: (local.lastDay || "") >= (cloud.lastDay || "") ? local.lastDay : cloud.lastDay,
  };
}

function mergeShop(local, cloud) {
  if (!cloud) return local;
  return {
    owned: [...new Set([...local.owned, ...(cloud.owned || [])])],
    equipped: cloud.equipped && cloud.equipped.length ? cloud.equipped : local.equipped,
    flavor: cloud.flavor || local.flavor || "matcha",
  };
}

function updateAuthUI(user) {
  const btn = $("authBtn");
  const avatar = $("userAvatar");
  if (user) {
    btn.textContent = "Sign out";
    if (user.photoURL) { avatar.src = user.photoURL; avatar.hidden = false; }
    else { avatar.hidden = true; }
  } else {
    btn.textContent = "Sign in";
    avatar.hidden = true;
  }
}

// ---------- home tab ----------
function renderHome() {
  $("stickerBook").innerHTML = ALL_LETTERS.filter(letterDone).length > 0
    ? ALL_LETTERS.filter(letterDone).map(l =>
        `<li class="sticker earned"><span class="disc" aria-hidden="true">${l}</span><span class="cap">${l}</span></li>`
      ).join("")
    : '<li class="sticker"><span class="disc" aria-hidden="true">?</span><span class="cap">Complete letters to collect!</span></li>';

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

// ---------- letters tab ----------
function renderLetters() {
  const grid = $("letterGrid");
  grid.innerHTML = "";
  ALL_LETTERS.forEach(letter => {
    const trained = knows(letter);
    const done = letterDone(letter);
    const unlocked = letterUnlocked(letter);
    const coins = done ? LETTER_COINS_REPLAY : LETTER_COINS_FIRST;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "letter-card" + (done ? " is-done" : "") + (!unlocked || !trained ? " is-locked" : "");
    btn.disabled = !trained || !unlocked;
    btn.innerHTML = `
      <span class="letter-card-letter">${letter}</span>
      <span class="letter-card-status">${done ? "Learned" : !trained ? "Not trained" : !unlocked ? "Locked" : "Ready"}</span>
      <span class="letter-card-coins">${COIN} ${coins}</span>`;
    btn.setAttribute("aria-label", `Letter ${letter}. ${done ? "Learned" : !unlocked ? "Locked" : "Ready"}`);
    btn.addEventListener("click", () => { returnTab = "letters"; startSingleLetter(letter); });
    grid.append(btn);
  });
}

// ---------- words tab ----------
function renderWords() {
  const list = $("wordLevels");
  list.innerHTML = "";
  const hasAnyLetter = (progress.lettersCompleted || []).length > 0;

  WORD_SETS.forEach((ws) => {
    const playableWords = classifier ? ws.words.filter((w) => wordPlayable(w)) : [];
    const done = (progress.wordsCompleted || []).includes(ws.id);
    const unlocked = hasAnyLetter && playableWords.length > 0;
    const coins = done ? Math.round(ws.reward / 3) : ws.reward;
    let status = done ? "Done" : unlocked ? `${playableWords.length} words` : "Complete a letter first";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level word-level" + (done ? " is-done" : "") + (unlocked ? "" : " is-locked");
    btn.disabled = !unlocked;
    btn.innerHTML = `
      <span class="level-num wl-reward">${COIN}${coins}</span>
      <span class="level-letters wl-words">${ws.words.join("  ")}</span>
      <span class="level-status">${status}</span>`;
    btn.setAttribute("aria-label", `${ws.name}: ${ws.words.join(", ")}. ${status}`);
    btn.addEventListener("click", () => { returnTab = "words"; startWordSet(ws); });
    const li = document.createElement("li");
    li.append(btn);
    list.append(li);
  });
}

// ---------- review tab ----------
function renderReview() {
  const completed = progress.lettersCompleted || [];
  const reviewGrid = $("reviewLetters");
  if (completed.length === 0) {
    reviewGrid.innerHTML = '<p class="empty-state">No letters completed yet. Head to the Letters tab to start!</p>';
  } else {
    reviewGrid.innerHTML = "";
    completed.sort().forEach(letter => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "letter-card is-done";
      btn.innerHTML = `
        <span class="letter-card-letter">${letter}</span>
        <span class="letter-card-status">Review</span>
        <span class="letter-card-coins">${COIN} ${LETTER_COINS_REPLAY}</span>`;
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
}

// ---------- shop tab ----------
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
    else if (canAfford) { actionText = `Buy \u00B7 ${item.price}`; actionClass = ""; }
    else { actionText = `${item.price}`; actionClass = "is-expensive"; }

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
    if (shop.equipped.includes(itemId)) {
      shop.equipped = shop.equipped.filter((id) => id !== itemId);
    } else {
      shop.equipped.push(itemId);
    }
    persistShop();
    renderMascots();
    renderShop();
  } else if ((progress.coins || 0) >= item.price) {
    progress.coins -= item.price;
    persistProgress();
    shop.owned.push(itemId);
    shop.equipped.push(itemId);
    persistShop();
    renderMascots();
    renderShop();
    $("coinDisplay").textContent = progress.coins;
  }
}

// ---------- navigation ----------
function goHome() {
  closeCamera();
  $("play").hidden = true;
  $("wordDisplay").hidden = true;
  play.mode = "letter";
  switchTab(returnTab);
}

// Daily practice: pick the next unlearned letter, or a random one to review.
function dailyPractice() {
  const next = ALL_LETTERS.find(l => knows(l) && letterUnlocked(l) && !letterDone(l));
  if (next) {
    returnTab = "home";
    startSingleLetter(next);
  } else {
    // All done — review a random learned letter
    const learned = ALL_LETTERS.filter(l => knows(l) && letterDone(l));
    if (learned.length) {
      returnTab = "home";
      startSingleLetter(pick(learned));
    }
  }
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

// ---------- playing a single letter ----------
async function startSingleLetter(letter) {
  play.mode = "letter";
  play.queue = [letter];
  play.idx = 0;
  play.skipped = new Set();
  document.querySelectorAll(".tab-panel").forEach(p => p.hidden = true);
  $("play").hidden = false;
  $("wordDisplay").hidden = true;
  $("levelLabel").textContent = `Letter ${letter}`;
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
  signBuffer.clear();

  $("targetLetter").textContent = letter;
  $("letterCount").textContent = `${play.idx + 1} of ${play.queue.length}`;
  $("hint").textContent = HINTS[letter] || "";
  $("seeing").textContent = "";

  const img = $("signImg");
  $("signRef").hidden = true;
  img.onload = () => ($("signRef").hidden = false);
  img.onerror = () => ($("signRef").hidden = true);
  img.alt = `Reference photo of the ASL letter ${letter}`;
  img.src = signPath(letter);

  setRing(0);
  play.mood = "";
  play.lastClose = 0;
  setMood("idle", isMotion(letter) ? `Draw the letter ${letter} in the air.` : `Show me the letter ${letter}.`, true);
}

// ---------- word challenges ----------
async function startWordSet(ws) {
  play.mode = "word";
  play.wordSet = ws;
  play.queue = ws.words.filter((w) => wordPlayable(w));
  play.idx = 0;
  play.wordPos = 0;
  play.skipped = new Set();
  document.querySelectorAll(".tab-panel").forEach(p => p.hidden = true);
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
  signBuffer.clear();

  $("targetLetter").textContent = letter;
  $("hint").textContent = HINTS[letter] || "";
  $("seeing").textContent = "";
  renderWordDisplay(word, play.wordPos);

  const img = $("signImg");
  $("signRef").hidden = true;
  img.onload = () => ($("signRef").hidden = false);
  img.onerror = () => ($("signRef").hidden = true);
  img.alt = `Reference photo of the ASL letter ${letter}`;
  img.src = signPath(letter);

  setRing(0);
  play.mood = "";
  play.lastClose = 0;
  setMood("idle", `Spell "${word}" \u2014 show me ${letter}.`, true);
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
  persistProgress();

  $("bigSticker").innerHTML = `<img src="assets/coin.png" alt="coins" style="width:3rem">`;
  $("celebrateTitle").textContent = `${ws.name} complete!`;
  $("celebrateText").textContent = firstTime
    ? "Great spelling! Those coins are yours."
    : "Nice practice run!";
  $("coinReward").textContent = `+${coins} coins`;
  $("coinReward").hidden = false;
  $("nextLetterBtn").hidden = true;
  confetti();
  $("celebrate").showModal();
}

// ---------- game loop ----------
function onFrame(lm) {
  const canvas = $("overlay");
  drawHand(canvas.getContext("2d"), lm, canvas.width, canvas.height);
  if ($("play").hidden || play.busy || !classifier) return;

  const target = currentTarget();
  if (isMotion(target)) {
    onMotionFrame(lm, target);
    return;
  }
  const rule = STRICTNESS[settings.strictness] || STRICTNESS.normal;

  if (!lm) {
    $("seeing").textContent = "I can't see a hand yet. Hold it up inside the frame.";
    play.hold = Math.max(0, play.hold - 1);
    setRing(play.hold / rule.hold);
    return;
  }

  const { label, conf, targetConf } = classifier.predict(toFeatures(lm, aspect, settings.leftHanded), target);
  const close = label === target || targetConf >= CLOSE_CONF;
  $("seeing").textContent =
    label === target ? `That's ${label}! Hold it!`
    : close ? `Close! It's somewhere between ${target} and ${label}.`
    : `Right now that looks like ${label}.`;

  if (label === target && conf >= rule.conf) play.hold += 1;
  else play.hold = Math.max(0, play.hold - 2);
  updateProgress(play.hold / rule.hold, close, HOLDING);
}

// J and Z: the clip model watches the last 0.8 seconds of movement.
function onMotionFrame(lm, target) {
  if (!lm) {
    $("seeing").textContent = "I can't see a hand yet. Hold it up inside the frame.";
    return;
  }
  const now = performance.now();
  signBuffer.push(now, lm, aspect, settings.leftHanded);
  if (++frameNo % PREDICT_EVERY) return;
  const clip = signBuffer.clip(now);
  if (!clip) return;

  const rule = MOTION_STRICTNESS[settings.strictness] || MOTION_STRICTNESS.normal;
  const { label, conf, targetConf } = signClassifier.predict(clip, target);
  const close = label === target || targetConf >= CLOSE_CONF;
  $("seeing").textContent =
    label === target ? `That's ${target}! Keep drawing it!`
    : label === NONE || close ? `Draw ${target} in the air. I watch the last second.`
    : `Right now that looks like ${label}.`;

  if (label === target && conf >= rule.conf) play.hold += 1;
  else play.hold = Math.max(0, play.hold - 1);
  updateProgress(play.hold / rule.hold, close, DRAWING);
}

// Fill the ring and set Mochi's mood. `almost` is what Mochi says past halfway.
function updateProgress(filled, close, almost) {
  setRing(filled);
  if (filled >= 1) {
    success();
    return;
  }

  const now = performance.now();
  if (close) play.lastClose = now;

  if (filled >= 0.5) {
    setMood("holding", almost);
  } else if (close) {
    setMood("close", CLOSE);
  } else if (now - play.letterStart > 12000 && now - play.lastNudge > 9000) {
    play.lastNudge = now;
    setMood("nudge", NUDGES, true);
  } else if (play.mood !== "nudge" && now - play.lastClose > 2500) {
    setMood("idle");
  }
}

function success() {
  play.busy = true;
  setRing(1);
  $("target").classList.add("is-hit");
  setMood("cheer", CHEERS, true);
  chime();
  setTimeout(() => {
    $("target").classList.remove("is-hit");
    if (play.mode === "word") advanceWord();
    else advance();
  }, 1100);
  progress = bumpStreak(progress);
  persistProgress();
  $("streakCount").textContent = currentStreak(progress);
}

function advance() {
  play.idx += 1;
  if (play.idx >= play.queue.length) finishLetter();
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
    // For single letters, just go back
    goHome();
  }
}

function finishLetter() {
  play.busy = true;
  closeCamera();
  const letter = play.queue[0];
  const firstTime = !letterDone(letter);
  const coins = firstTime ? LETTER_COINS_FIRST : LETTER_COINS_REPLAY;

  if (firstTime) {
    if (!progress.lettersCompleted) progress.lettersCompleted = [];
    progress.lettersCompleted.push(letter);
  }
  progress.coins = (progress.coins || 0) + coins;
  persistProgress();

  $("bigSticker").textContent = letter;
  $("celebrateTitle").textContent = firstTime ? `You learned the letter ${letter}!` : `Nice review of ${letter}!`;
  $("celebrateText").textContent = firstTime
    ? "Keep going to unlock more letters."
    : "Practice makes perfect!";
  $("coinReward").textContent = `+${coins} coins`;
  $("coinReward").hidden = false;

  // Show "Next letter" if there's a next unlocked+trained letter
  const idx = ALL_LETTERS.indexOf(letter);
  const next = ALL_LETTERS.slice(idx + 1).find(l => knows(l) && letterUnlocked(l));
  $("nextLetterBtn").hidden = !next;
  $("nextLetterBtn").onclick = next ? () => { goingToNextLetter = true; $("celebrate").close(); startSingleLetter(next); } : null;

  confetti();
  $("celebrate").showModal();
}

function confetti() {
  const box = $("confetti");
  box.innerHTML = "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bits = ["\u2728", "\uD83D\uDC9C", "\uD83D\uDC9B", "\uD83C\uDF38", "\u2728"];
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
  renderTab(activeTab);
}

// ---------- wiring ----------
$("continueBtn").addEventListener("click", dailyPractice);
$("backBtn").addEventListener("click", goHome);
$("skipBtn").addEventListener("click", skipLetter);
$("settingsBtn").addEventListener("click", openSettings);
$("authBtn").addEventListener("click", async () => {
  if (currentUser()) {
    signOutUser();
  } else {
    try { await signIn(); } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") console.error("Sign-in failed:", err);
    }
  }
});
$("settingsDone").addEventListener("click", () => $("settings").close());
$("settings").addEventListener("change", updateSettings);

let goingToNextLetter = false;
$("toLevelsBtn").addEventListener("click", () => $("celebrate").close());
$("celebrate").addEventListener("close", () => {
  $("coinReward").hidden = true;
  if (!goingToNextLetter) goHome();
  goingToNextLetter = false;
});

(async function init() {
  applySettings();
  switchTab("home");

  onAuthChange(async (user) => {
    updateAuthUI(user);
    if (user) {
      const cloud = await loadFromCloud();
      if (cloud) {
        progress = mergeProgress(progress, cloud.progress || {});
        shop = mergeShop(shop, cloud.shop || {});
        saveProgress(progress);
        saveShop(shop);
      }
      syncToCloud();
      renderMascots();
      renderTab(activeTab);
    }
  });

  [classifier, signClassifier] = await Promise.all([loadClassifier(), loadSignClassifier()]);
  modelLoaded = true;
  renderTab(activeTab);
})();
