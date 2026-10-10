import { createHandTracker, startCamera, runLoop, toFeatures, drawHand } from "./hands.js";
import { LETTERS } from "./letters.js";
import { loadSettings, saveSettings, loadSamples, saveSamples, getItem, setItem, dayKey } from "./store.js";

const FRAMES_PER_TAKE = 40; // samples saved per take
const FRAME_STRIDE = 2; // keep every 2nd frame so a take spans about 3 seconds
const TARGET_PER_LETTER = 80; // per signer: two takes per letter

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let settings = loadSettings();
let samples = loadSamples();
let recording = null; // { label, person, got, tick }
let countingDown = false;
let aspect = 4 / 3;

// ---------- UI setup ----------
LETTERS.forEach((l) => $("letter").add(new Option(l, l)));
$("signer").value = getItem("sls_signer", "");
$("setLeft").checked = settings.leftHanded;

$("signer").addEventListener("input", () => {
  setItem("sls_signer", $("signer").value.trim());
  renderCounts();
});
$("letter").addEventListener("change", renderCounts);
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
  const current = $("letter").value;
  $("countsTitle").textContent = person ? `${person}'s samples` : "Samples";
  $("counts").innerHTML = LETTERS.map((l) => {
    const n = mine[l] || 0;
    const cls = [n >= TARGET_PER_LETTER ? "full" : "", l === current ? "current" : ""].join(" ").trim();
    return `<li class="${cls}"><b>${l}</b><span>${n}</span></li>`;
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
  const label = $("letter").value;
  countingDown = true;
  $("recordBtn").disabled = true;
  for (const n of [3, 2, 1]) {
    $("countdown").textContent = n;
    await sleep(700);
  }
  $("countdown").textContent = "";
  countingDown = false;
  recording = { label, person, got: 0, tick: 0 };
  status(`Recording ${label}. Slowly move your hand a little: closer, farther, slightly tilted.`);
}

function finishTake() {
  const { label, person } = recording;
  recording = null;
  $("recordBtn").disabled = false;
  $("progressFill").style.width = "0%";
  if (!saveSamples(samples)) {
    status("Browser storage is full. Download your CSV now so nothing is lost.");
  }
  const have = countFor(person)[label] || 0;
  if (have >= TARGET_PER_LETTER) {
    const next = LETTERS[LETTERS.indexOf(label) + 1];
    if (next) {
      $("letter").value = next;
      status(`${label} is done. Moved on to ${next}.`);
    } else {
      status("You've recorded every letter. Download your CSV and send it to your ML lead.");
    }
  } else {
    status(`Saved a take of ${label}. Record one more from a different angle.`);
  }
  renderCounts();
}

function onFrame(lm) {
  const canvas = $("overlay");
  drawHand(canvas.getContext("2d"), lm, canvas.width, canvas.height);
  $("handState").textContent = lm ? "Hand found" : "No hand in view";
  $("handState").classList.toggle("ok", !!lm);

  if (!recording || !lm) return;
  recording.tick += 1;
  if (recording.tick % FRAME_STRIDE !== 0) return;
  const f = toFeatures(lm, aspect, settings.leftHanded).map((v) => Math.round(v * 10000) / 10000);
  samples.push({ person: recording.person, label: recording.label, f });
  recording.got += 1;
  $("progressFill").style.width = `${(recording.got / FRAMES_PER_TAKE) * 100}%`;
  if (recording.got >= FRAMES_PER_TAKE) finishTake();
}

// ---------- CSV import / export ----------
const HEADER = ["person", "label", ...Array.from({ length: 63 }, (_, i) => `f${i}`)];
const clean = (s) => String(s).replace(/[",\r\n]/g, " ").trim();

function downloadCSV() {
  if (!samples.length) {
    status("Nothing to download yet. Record a few takes first.");
    return;
  }
  const lines = [HEADER.join(","), ...samples.map((s) => [clean(s.person), s.label, ...s.f].join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = clean($("signer").value || "team").replace(/\s+/g, "_");
  a.href = url;
  a.download = `samples_${name}_${dayKey()}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  status(`Downloaded ${samples.length} samples. Put the file in the project's data/ folder.`);
}

async function importCSV(files) {
  let added = 0;
  for (const file of files) {
    const rows = (await file.text()).trim().split(/\r?\n/);
    const head = rows.shift().split(",");
    const pi = head.indexOf("person");
    const li = head.indexOf("label");
    const fi = Array.from({ length: 63 }, (_, i) => head.indexOf(`f${i}`));
    if (pi < 0 || li < 0 || fi.includes(-1)) {
      status(`${file.name} isn't a recorder CSV, so it was skipped.`);
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
  const saved = saveSamples(samples);
  renderCounts();
  status(saved ? `Imported ${added} samples.` : `Imported ${added} samples, but browser storage is full. The game may not see all of them.`);
}

$("recordBtn").addEventListener("click", record);
$("downloadBtn").addEventListener("click", downloadCSV);
$("importBtn").addEventListener("click", () => $("importInput").click());
$("importInput").addEventListener("change", (e) => {
  if (e.target.files.length) importCSV([...e.target.files]);
  e.target.value = "";
});
$("clearBtn").addEventListener("click", () => {
  if (!confirm("Delete every sample saved in this browser? Download a CSV first if you need them.")) return;
  samples = [];
  saveSamples(samples);
  renderCounts();
  status("All samples cleared.");
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
