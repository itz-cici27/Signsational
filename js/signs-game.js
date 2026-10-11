// Play screen for whole-word signs (signs.html). Entry point: signs.html?word=HELLO
import { createHandTracker, startCamera, runLoop, drawHand } from "./hands.js";
import { SIGN_WORDS, NONE, SignBuffer, loadSignClassifier, signRewards } from "./signs.js";
import { loadSettings, loadProgress, saveProgress, bumpStreak, currentStreak, loadShop, recordStat } from "./store.js";
import { mascotSVG, applyFlavor } from "./mascot.js";
import { stickerStats, newStickers, stickerSVG } from "./stickers.js";

// How sure the model must be, and for how many checks in a row (one check every
// PREDICT_EVERY frames, so ~10 checks per second).
const STRICTNESS = {
  easy: { conf: 0.5, hold: 3 },
  normal: { conf: 0.6, hold: 4 },
  strict: { conf: 0.75, hold: 6 },
};
const PREDICT_EVERY = 3;
const RING = 2 * Math.PI * 54;
const CHEERS = ["You signed it!", "Beautiful sign!", "Nailed it!", "So smooth!"];
const NUDGES = [
  "Sign it a few times in a row. I watch the last second.",
  "Read the hint, or watch the video link.",
  "Keep your whole hand in the frame while it moves.",
  "Try a little slower and bigger.",
];

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const settings = loadSettings();
const rule = STRICTNESS[settings.strictness] || STRICTNESS.normal;
const buffer = new SignBuffer();
let progress = loadProgress();
let classifier = null;
let aspect = 4 / 3;
let frameNo = 0;
let audioCtx = null;
const play = { queue: [], idx: 0, hold: 0, busy: true, start: 0, lastNudge: 0 };

// Opened from the Review tab (signs.html?words=PLEASE,SORRY&from=review): play just those
// words once, then go back to Review.
const params = new URLSearchParams(location.search);
const fromReview = params.get("from") === "review";
const reviewWords = (params.get("words") || "").split(",").filter(Boolean);
if (fromReview) {
  document.querySelectorAll('a[href="index.html#signWordsTitle"]').forEach((a) => {
    a.href = "index.html#review";
    a.textContent = "Back to review";
  });
}

// Time (or skip) for this sign, for the Review tab's "Worst to Best" piles.
function recordSignStat(word, skipped) {
  const secs = Math.max(0.5, (performance.now() - play.start) / 1000);
  recordStat(progress.signStats ||= {}, word, skipped, secs);
}

document.documentElement.classList.toggle("big-text", settings.bigText);
applyFlavor(loadShop().flavor);
document.querySelectorAll("[data-mascot]").forEach((el) => (el.innerHTML = mascotSVG(loadShop().equipped)));

function renderHeader() {
  $("coinDisplay").textContent = progress.coins || 0;
  $("streakCount").textContent = currentStreak(progress);
}

function say(text, mood = "") {
  $("playBubble").textContent = text;
  $("playMascot").classList.remove("is-cheer", "is-think");
  if (mood) $("playMascot").classList.add(mood);
}

function setRing(fraction) {
  $("ringFill").style.strokeDashoffset = String(RING * (1 - Math.max(0, Math.min(1, fraction))));
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

function showSign() {
  const s = play.queue[play.idx];
  play.hold = 0;
  play.busy = false;
  play.start = play.lastNudge = performance.now();
  buffer.clear();
  if (!fromReview) history.replaceState(null, "", `?word=${encodeURIComponent(s.word)}`);
  $("wordCount").textContent = `${play.idx + 1} of ${play.queue.length}`;
  $("targetEmoji").textContent = s.emoji;
  $("signName").textContent = s.word;
  $("hint").textContent = s.hint;
  $("signVideo").href = `https://www.signasl.org/sign/${s.slug}`;
  const demo = $("demoVideo");
  $("signDemo").hidden = true;
  demo.onloadeddata = () => ($("signDemo").hidden = false);
  demo.onerror = () => ($("signDemo").hidden = true); // offline: just leave it out
  if (s.video) demo.src = s.video;
  else demo.removeAttribute("src"); // no demo for this word: the hint and SignASL link are enough
  $("seeing").textContent = "";
  setRing(0);
  say(`Sign ${s.word} for me. Repeat it until the ring fills.`);
}

function nextSign() {
  if (fromReview && play.idx === play.queue.length - 1) {
    location.href = "index.html#review";
    return;
  }
  play.idx = (play.idx + 1) % play.queue.length;
  showSign();
}

function onFrame(lm) {
  const canvas = $("overlay");
  drawHand(canvas.getContext("2d"), lm, canvas.width, canvas.height);
  if (play.busy) return;
  const now = performance.now();

  if (!lm) {
    $("seeing").textContent = "I can't see a hand yet. Hold it up inside the frame.";
    return;
  }
  buffer.push(now, lm, aspect, settings.leftHanded);
  if (++frameNo % PREDICT_EVERY) return;
  const clip = buffer.clip(now);
  if (!clip) return; // still filling up the last second

  const target = play.queue[play.idx].word;
  const { label, conf } = classifier.predict(clip);
  if (label === target && conf >= rule.conf) {
    play.hold += 1;
    $("seeing").textContent = `That looks like ${label}. Keep going!`;
  } else {
    play.hold = Math.max(0, play.hold - 1);
    $("seeing").textContent = label === NONE || label === target ? "Watching for the sign…" : `Right now that looks like ${label}.`;
  }
  setRing(play.hold / rule.hold);
  if (play.hold >= rule.hold) {
    success();
    return;
  }

  if (now - play.start > 12000 && now - play.lastNudge > 9000) {
    play.lastNudge = now;
    say(pick(NUDGES), "is-think");
  }
}

function success() {
  play.busy = true;
  const s = play.queue[play.idx];
  setRing(1);
  $("target").classList.add("is-hit");
  say(pick(CHEERS), "is-cheer");
  chime();

  progress = loadProgress(); // re-read in case another tab changed it
  const done = progress.signsCompleted || [];
  const firstTime = !done.includes(s.word);
  const coins = signRewards(!firstTime);
  const statsBefore = stickerStats(progress);
  if (firstTime) progress.signsCompleted = [...done, s.word];
  recordSignStat(s.word, false);
  progress.wordsSigned = statsBefore.words + 1; // every completed word counts toward word stickers
  const earned = newStickers(statsBefore, stickerStats(progress));
  progress.coins = (progress.coins || 0) + coins;
  progress = bumpStreak(progress);
  saveProgress(progress);
  renderHeader();

  setTimeout(() => {
    $("target").classList.remove("is-hit");
    const big = $("bigSticker");
    const newest = earned[earned.length - 1];
    big.classList.toggle("is-sticker", !!newest);
    if (newest) big.innerHTML = stickerSVG(newest);
    else big.textContent = s.emoji;
    $("celebrateTitle").textContent = `You signed ${s.word}!`;
    $("celebrateText").textContent = newest
      ? `You earned the "${earned.map((st) => st.label).join('" and "')}" sticker${earned.length > 1 ? "s" : ""}!`
      : firstTime ? "A brand new word for your collection." : "Nice practice. Repetition makes it stick.";
    $("coinReward").textContent = `+${coins} coins`;
    confetti(s.emoji);
    $("celebrate").showModal();
  }, 900);
}

function confetti(emoji) {
  const box = $("confetti");
  box.innerHTML = "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bits = ["\u2728", "\uD83D\uDC9C", "\uD83D\uDC9B", "\u2728", emoji];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span");
    s.textContent = pick(bits);
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    s.style.fontSize = `${1 + Math.random()}rem`;
    box.append(s);
  }
}

$("skipBtn").addEventListener("click", () => {
  if (play.busy) return;
  progress = loadProgress(); // re-read in case another tab changed it
  recordSignStat(play.queue[play.idx].word, true);
  saveProgress(progress);
  nextSign();
});
$("nextBtn").addEventListener("click", () => $("celebrate").close());
$("celebrate").addEventListener("close", nextSign);

(async function init() {
  renderHeader();
  classifier = await loadSignClassifier();
  play.queue = classifier ? SIGN_WORDS.filter((s) => classifier.labels.includes(s.word)) : [];
  if (fromReview && reviewWords.length) {
    const pile = reviewWords.map((w) => play.queue.find((s) => s.word === w)).filter(Boolean);
    if (pile.length) play.queue = pile;
  }
  if (!play.queue.length) {
    $("signName").textContent = "No word model yet";
    $("hint").innerHTML = 'Record words in the <a href="words-recorder.html">word recorder</a>, then run <code>python train_words.py</code>.';
    $("skipBtn").hidden = true;
    $("signDemo").hidden = true;
    return;
  }
  const wanted = params.get("word");
  play.idx = Math.max(0, play.queue.findIndex((s) => s.word === wanted));
  showSign();

  const video = $("video");
  try {
    $("camStatus").textContent = "Loading hand tracker";
    const tracker = await createHandTracker();
    $("camStatus").textContent = "Starting camera";
    await startCamera(video);
    aspect = video.videoWidth / video.videoHeight || 4 / 3;
    $("overlay").width = video.videoWidth;
    $("overlay").height = video.videoHeight;
    $("camStatus").textContent = "";
    play.start = play.lastNudge = performance.now(); // camera start-up time shouldn't count as slow
    runLoop(video, tracker, onFrame);
  } catch (err) {
    console.error(err);
    $("camStatus").textContent =
      err && err.name === "NotAllowedError"
        ? "Camera access is blocked. Allow the camera in your browser's address bar, then reload."
        : "The camera or hand tracker didn't start. Check your internet connection and reload.";
  }
})();
