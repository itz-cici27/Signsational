// Whole-word ASL signs (HELLO, THANK YOU, ...). Unlike letters, these involve
// motion, so the model looks at a short clip instead of a single frame.
//
// A clip is 15 frames resampled evenly across the last 0.8 seconds. Each frame
// becomes 44 numbers: the handshape (21 landmarks, x and y, centered on the
// wrist and scaled by palm size) plus how far the wrist has moved since the
// start of the clip. 15 x 44 = 660 numbers per clip.
//
// The z (depth) coordinate is left out so we can reuse the open word dataset
// from github.com/laplaces42/sign-language-interpreter, which only has x and y.
import { toFeatures } from "./hands.js";
import { MLP, KNN } from "./classifier.js";
import { getItem, setItem } from "./store.js";

export const SIGN_FRAMES = 15;
export const SIGN_WINDOW_MS = 800;
export const PER_FRAME = 44;
export const NONE = "NONE"; // "not a word": still hands, fidgeting, letters
const MAX_GAP_MS = 150; // a clip is invalid if the hand vanished for longer than this

// `video` is the clip SignASL.org shows for the sign (signasl.org/sign/<slug>),
// played on a loop on the sign page.
const VIDEO_BASE = "https://media.signbsl.com/videos/asl/";

// The first five have starter data from the open dataset. The rest appear in
// the game once your team records them in words-recorder.html and retrains.
export const SIGN_WORDS = [
  {
    word: "HELLO", emoji: "\u{1F44B}", slug: "hello",
    video: VIDEO_BASE + "startasl/mp4/hello.mp4",
    hint: "Touch the side of your forehead with a flat hand, then move it out and away, like a little salute.",
  },
  {
    word: "THANK YOU", emoji: "\u{1F64F}", slug: "thank-you",
    video: VIDEO_BASE + "startasl/mp4/thankyou.mp4",
    hint: "Touch your fingertips to your chin with a flat hand, then move your hand forward and down.",
  },
  {
    word: "PLEASE", emoji: "\u{1F97A}", slug: "please",
    video: VIDEO_BASE + "startasl/mp4/please.mp4",
    hint: "Rub a flat hand in a circle on your chest.",
  },
  {
    word: "SORRY", emoji: "\u{1F614}", slug: "sorry",
    video: VIDEO_BASE + "startasl/mp4/sorry.mp4",
    hint: "Make a fist (the letter A) and rub it in a circle on your chest.",
  },
  {
    word: "WELCOME", emoji: "\u{1F917}", slug: "welcome",
    video: VIDEO_BASE + "aslsignbank/mp4/WELCOME-1476.mp4",
    hint: "Hold a flat hand out to the side, palm up, and sweep it in toward your body.",
  },
  {
    word: "YES", emoji: "\u{1F44D}", slug: "yes",
    video: VIDEO_BASE + "startasl/mp4/yes.mp4",
    hint: "Make a fist (the letter S) and nod it up and down at the wrist, like a head nodding.",
  },
  {
    word: "NO", emoji: "\u{1F645}", slug: "no",
    video: VIDEO_BASE + "startasl/mp4/no.mp4",
    hint: "Hold your index and middle fingers out, then snap them closed onto your thumb.",
  },
  {
    word: "EAT", emoji: "\u{1F34E}", slug: "eat",
    video: VIDEO_BASE + "startasl/mp4/eat.mp4",
    hint: "Bunch your fingertips together onto your thumb and tap them to your mouth twice.",
  },
  {
    word: "I LOVE YOU", emoji: "\u{1F91F}", slug: "i-love-you",
    video: VIDEO_BASE + "youtube/mp4/dEUvcuoKxsk.mp4",
    hint: "Stretch out your thumb, index finger, and pinky. Keep the middle two fingers down. Face your palm out.",
  },
];

export const signRewards = (done) => (done ? 5 : 20);

// ---------- features ----------

// One video frame -> handshape (42 numbers) plus wrist position and palm size.
export function frameInfo(lm, aspect, leftHanded) {
  const shape = toFeatures(lm, aspect, leftHanded).filter((_, i) => i % 3 !== 2); // drop z
  const flip = leftHanded ? -1 : 1;
  const size = Math.hypot((lm[9].x - lm[0].x) * aspect, lm[9].y - lm[0].y) || 1;
  return { shape, wx: flip * lm[0].x * aspect, wy: lm[0].y, size };
}

// SIGN_FRAMES frame infos -> one 660-number clip.
export function clipFeatures(frames) {
  const size = frames.reduce((a, f) => a + f.size, 0) / frames.length;
  const out = [];
  for (const f of frames) {
    out.push(...f.shape, (f.wx - frames[0].wx) / size, (f.wy - frames[0].wy) / size);
  }
  return out;
}

// Resample timed frames ({ t, ...frameInfo }, sorted by t) between start and end.
// Returns null if the hand was missing for part of that stretch.
export function clipAt(frames, start, end) {
  const picked = [];
  let j = 0;
  for (let i = 0; i < SIGN_FRAMES; i++) {
    const t = start + ((end - start) * i) / (SIGN_FRAMES - 1);
    while (j + 1 < frames.length && Math.abs(frames[j + 1].t - t) <= Math.abs(frames[j].t - t)) j++;
    if (!frames[j] || Math.abs(frames[j].t - t) > MAX_GAP_MS) return null;
    picked.push(frames[j]);
  }
  return clipFeatures(picked);
}

// Cut a recorded take into overlapping clips (one training sample each).
export function sliceTake(frames, strideMs = 300) {
  const clips = [];
  if (!frames.length) return clips;
  const first = frames[0].t;
  const last = frames[frames.length - 1].t;
  for (let end = first + SIGN_WINDOW_MS; end <= last; end += strideMs) {
    const clip = clipAt(frames, end - SIGN_WINDOW_MS, end);
    if (clip) clips.push(clip);
  }
  return clips;
}

// Rolling buffer of recent frames for live recognition.
export class SignBuffer {
  constructor() {
    this.frames = [];
  }

  push(t, lm, aspect, leftHanded) {
    this.frames.push({ t, ...frameInfo(lm, aspect, leftHanded) });
    while (this.frames.length && this.frames[0].t < t - SIGN_WINDOW_MS - 300) this.frames.shift();
  }

  clear() {
    this.frames = [];
  }

  clip(now) {
    return clipAt(this.frames, now - SIGN_WINDOW_MS, now);
  }
}

// ---------- storage + model ----------

export const loadWordSamples = () => getItem("sls_word_samples", []);
export const saveWordSamples = (s) => setItem("sls_word_samples", s);

// MLP from model/words.json (trained by train_words.py), or kNN on clips
// recorded in this browser as a quick start.
export async function loadSignClassifier() {
  try {
    const res = await fetch("model/words.json", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.layers) return new MLP(json);
    }
  } catch {
    // no trained word model yet
  }
  const samples = loadWordSamples();
  if (samples.length >= 20) return new KNN(samples, 5);
  return null;
}
