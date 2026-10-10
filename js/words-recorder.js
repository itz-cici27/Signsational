// Records whole-word sign clips (words-recorder.html). Entry point for that page.
import { createHandTracker, startCamera, runLoop, drawHand } from "./hands.js";
import { SIGN_WORDS, NONE, SIGN_FRAMES, PER_FRAME, frameInfo, sliceTake, loadWordSamples, saveWordSamples } from "./signs.js";
import { loadSettings, saveSettings, getItem, setItem, dayKey } from "./store.js";
import { MOTION_LETTERS, HINTS } from "./letters.js";

const TAKE_MS = 4000;
const TARGET_PER_WORD = 40; // clips per signer: about four takes
const LABELS = [...SIGN_WORDS.map((s) => s.word), ...MOTION_LETTERS, NONE];
const N_FEATURES = SIGN_FRAMES * PER_FRAME;

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let settings = loadSettings();
let samples = loadWordSamples();
let recording = null; // { label, person, start, frames }
let countingDown = false;
let aspect = 4 / 3;

// ---------- UI setup ----------
const optionName = (w) => (w === NONE ? "NONE (not a sign)" : MOTION_LETTERS.includes(w) ? `Letter ${w}` : w);
LABELS.forEach((w) => $("word").add(new Option(optionName(w), w)));
$("signer").value = getItem("sls_signer", "");
$("setLeft").checked = settings.leftHanded;

$("signer").addEventListener("input", () => {
  setItem("sls_signer", $("signer").value.trim());
  renderCounts();
});
$("word").addEventListener("change", renderCounts);
$("setLeft").addEventListener("change", () => {
  settings = { ...settings, leftHanded: $("setLeft").checked };
  saveSettings(settings);
});

function status(text) {
  $("recStatus").textContent = text;
}

function countFor(person) {
  const counts = {};
  for (const s of samples) if (!person || s.person === person) counts[s.label] = (counts[s.label] || 0) + 1;
  return counts;
}

function renderCounts() {
  const person = $("signer").value.trim();
  const mine = countFor(person);
  const current = $("word").value;
  const sign = SIGN_WORDS.find((s) => s.word === current);
  $("wordHint").textContent = sign ? sign.hint
    : MOTION_LETTERS.includes(current) ? HINTS[current]
    : "Wave, fidget, scratch your head, or hold up random letters. Include a still I and a still pointing finger, so the model learns J and Z need the motion.";
  $("countsTitle").textContent = person ? `${person}'s clips` : "Clips";
  $("counts").innerHTML = LABELS.map((w) => {
    const n = mine[w] || 0;
    const cls = [n >= TARGET_PER_WORD ? "full" : "", w === current ? "current" : ""].join(" ").trim();
    return `<li class="${cls}"><b>${w}</b><span>${n}</span></li>`;
  }).join("");

  const people = {};
  for (const s of samples) people[s.person] = (people[s.person] || 0) + 1;
  const summary = Object.entries(people).map(([p, n]) => `${p} (${n})`).join(", ");
  $("signers").textContent = summary ? `Saved in this browser: ${summary}.` : "Nothing recorded yet.";
}

// ---------- recording ----------
async function record() {
  if (recording || countingDown) return;
  const person = $("signer").value.trim();
  if (!person) {
    status("Add your name first. The trainer uses it to test the model on people it hasn't seen.");
    $("signer").focus();
    return;
  }
  const label = $("word").value;
  countingDown = true;
  $("recordBtn").disabled = true;
  for (const n of [3, 2, 1]) {
    $("countdown").textContent = n;
    await sleep(700);
  }
  $("countdown").textContent = "";
  countingDown = false;
  recording = { label, person, start: performance.now(), frames: [] };
  status(label === NONE ? "Recording NONE. Move your hand around naturally." : `Recording ${label}. Keep signing it until the bar fills.`);
}

function finishTake() {
  const { label, person, frames } = recording;
  recording = null;
  $("recordBtn").disabled = false;
  $("progressFill").style.width = "0%";

  const clips = sliceTake(frames);
  if (!clips.length) {
    status("Your hand was out of view too much, so nothing was saved. Try again.");
    return;
  }
  for (const c of clips) samples.push({ person, label, f: c.map((v) => Math.round(v * 10000) / 10000) });
  if (!saveWordSamples(samples)) {
    status("Browser storage is full. Download your CSV now so nothing is lost.");
    renderCounts();
    return;
  }
  const have = countFor(person)[label] || 0;
  if (have >= TARGET_PER_WORD) {
    const next = LABELS[LABELS.indexOf(label) + 1];
    if (next) {
      $("word").value = next;
      status(`${label} is done (${clips.length} clips from that take). Moved on to ${next}.`);
    } else {
      status("You've recorded every sign. Download your CSV and put it in data/words/.");
    }
  } else {
    status(`Saved ${clips.length} clips of ${label}. Record another take.`);
  }
  renderCounts();
}

function onFrame(lm) {
  const canvas = $("overlay");
  drawHand(canvas.getContext("2d"), lm, canvas.width, canvas.height);
  $("handState").textContent = lm ? "Hand found" : "No hand in view";
  $("handState").classList.toggle("ok", !!lm);

  if (!recording) return;
  const now = performance.now();
  if (lm) recording.frames.push({ t: now, ...frameInfo(lm, aspect, settings.leftHanded) });
  const done = (now - recording.start) / TAKE_MS;
  $("progressFill").style.width = `${Math.min(1, done) * 100}%`;
  if (done >= 1) finishTake();
}

// ---------- CSV import / export ----------
const HEADER = ["person", "label", ...Array.from({ length: N_FEATURES }, (_, i) => `w${i}`)];
const clean = (s) => String(s).replace(/[",\r\n]/g, " ").trim();

function downloadCSV() {
  if (!samples.length) {
    status("Nothing to download yet. Record a few takes first.");
    return;
  }
  const lines = [HEADER.join(","), ...samples.map((s) => [clean(s.person), clean(s.label), ...s.f].join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = clean($("signer").value || "team").replace(/\s+/g, "_");
  a.href = url;
  a.download = `words_${name}_${dayKey()}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  status(`Downloaded ${samples.length} clips. Put the file in the project's data/words/ folder.`);
}

async function importCSV(files) {
  let added = 0;
  for (const file of files) {
    const rows = (await file.text()).trim().split(/\r?\n/);
    const head = rows.shift().split(",");
    const pi = head.indexOf("person");
    const li = head.indexOf("label");
    const fi = Array.from({ length: N_FEATURES }, (_, i) => head.indexOf(`w${i}`));
    if (pi < 0 || li < 0 || fi.includes(-1)) {
      status(`${file.name} isn't a word-recorder CSV, so it was skipped.`);
      continue;
    }
    for (const row of rows) {
      const cols = row.split(",");
      const f = fi.map((i) => Number(cols[i]));
      if (f.some(Number.isNaN)) continue;
      samples.push({ person: cols[pi], label: cols[li].toUpperCase(), f });
      added += 1;
    }
  }
  const saved = saveWordSamples(samples);
  renderCounts();
  status(saved ? `Imported ${added} clips.` : `Imported ${added} clips, but browser storage is full. The game may not see all of them.`);
}

$("recordBtn").addEventListener("click", record);
$("downloadBtn").addEventListener("click", downloadCSV);
$("importBtn").addEventListener("click", () => $("importInput").click());
$("importInput").addEventListener("change", (e) => {
  if (e.target.files.length) importCSV([...e.target.files]);
  e.target.value = "";
});
$("clearBtn").addEventListener("click", () => {
  if (!confirm("Delete every word clip saved in this browser? Download a CSV first if you need them.")) return;
  samples = [];
  saveWordSamples(samples);
  renderCounts();
  status("All word clips cleared.");
});
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (e.code === "Space" && !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) {
    e.preventDefault();
    record();
  }
});

// ---------- start ----------
(async function init() {
  renderCounts();
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
    runLoop(video, tracker, onFrame);
  } catch (err) {
    console.error(err);
    $("camStatus").textContent =
      err && err.name === "NotAllowedError"
        ? "Camera access is blocked. Allow the camera in your browser's address bar, then reload."
        : "The camera or hand tracker didn't start. Check your internet connection and reload.";
  }
})();
