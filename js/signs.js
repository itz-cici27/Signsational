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
  // From WLASL (see data/words/README.md)
  {
    word: "HELP", emoji: "\u{1F64B}", slug: "help",
    video: VIDEO_BASE + "startasl/mp4/help.mp4",
    hint: "Rest a thumbs-up fist on your other flat palm, then lift both hands up together.",
  },
  {
    word: "NAME", emoji: "\u{1F4DB}", slug: "name",
    video: null, // no StartASL clip: the sign page shows just the hint
    hint: "Make an H (two fingers out) with both hands and tap one on top of the other twice.",
  },
  {
    word: "DEAF", emoji: "\u{1F9CF}", slug: "deaf",
    video: VIDEO_BASE + "startasl/mp4/deaf.mp4",
    hint: "Touch your index finger near your ear, then near your mouth.",
  },
  {
    word: "UNDERSTAND", emoji: "\u{1F4A1}", slug: "understand",
    video: null, // no StartASL clip: the sign page shows just the hint
    hint: "Hold a fist near your forehead and flick your index finger up.",
  },
  {
    word: "AGAIN", emoji: "\u{1F501}", slug: "again",
    video: VIDEO_BASE + "startasl/mp4/again.mp4",
    hint: "Flip a bent hand over and tap its fingertips into the palm of your other hand.",
  },
  {
    word: "WHAT", emoji: "\u{1F937}", slug: "what",
    video: VIDEO_BASE + "startasl/mp4/what.mp4",
    hint: "Hold both open hands out, palms up, and shake them slightly side to side.",
  },
  {
    word: "WHERE", emoji: "\u{1F4CD}", slug: "where",
    video: VIDEO_BASE + "startasl/mp4/where.mp4",
    hint: "Hold your index finger up, palm out, and shake it side to side.",
  },
  {
    word: "WANT", emoji: "\u{1F932}", slug: "want",
    video: VIDEO_BASE + "startasl/mp4/want.mp4",
    hint: "Hold both hands out, palms up, fingers bent like claws, and pull them toward you.",
  },
  {
    word: "NEED", emoji: "\u{2757}", slug: "need",
    video: VIDEO_BASE + "startasl/mp4/need.mp4",
    hint: "Hook your index finger (the letter X) and bend your wrist down twice.",
  },
  {
    word: "MORE", emoji: "\u{2795}", slug: "more",
    video: VIDEO_BASE + "startasl/mp4/more.mp4",
    hint: "Bunch the fingertips of both hands onto your thumbs and tap the fingertips together twice.",
  },
  {
    word: "FINISH", emoji: "\u{2705}", slug: "finish",
    video: VIDEO_BASE + "startasl/mp4/finish.mp4",
    hint: "Hold both open hands up, palms facing you, and flip them outward quickly.",
  },
  {
    word: "BATHROOM", emoji: "\u{1F6BD}", slug: "bathroom",
    video: VIDEO_BASE + "startasl/mp4/bathroom.mp4",
    hint: "Make the letter T (thumb tucked between your first two fingers) and shake it side to side.",
  },
  {
    word: "WATER", emoji: "\u{1F4A7}", slug: "water",
    video: VIDEO_BASE + "startasl/mp4/water.mp4",
    hint: "Make a W (three fingers up) and tap your index finger on your chin twice.",
  },
  {
    word: "DRINK", emoji: "\u{1F964}", slug: "drink",
    video: VIDEO_BASE + "startasl/mp4/drink.mp4",
    hint: "Curve your hand into a C, like holding a cup, and tip it toward your mouth.",
  },
  {
    word: "MOTHER", emoji: "\u{1F469}", slug: "mother",
    video: VIDEO_BASE + "startasl/mp4/mother.mp4",
    hint: "Spread all five fingers and tap your thumb on your chin.",
  },
  {
    word: "FATHER", emoji: "\u{1F468}", slug: "father",
    video: VIDEO_BASE + "startasl/mp4/father.mp4",
    hint: "Spread all five fingers and tap your thumb on your forehead.",
  },
  {
    word: "FAMILY", emoji: "\u{1F46A}", slug: "family",
    video: VIDEO_BASE + "startasl/mp4/family.mp4",
    hint: "Make an F with both hands, touching, and circle them outward until your pinkies meet.",
  },
  {
    word: "FRIEND", emoji: "\u{1F91D}", slug: "friend",
    video: VIDEO_BASE + "startasl/mp4/friend.mp4",
    hint: "Hook your index fingers together, then flip them and hook them the other way.",
  },
  {
    word: "LIKE", emoji: "\u{1F44D}", slug: "like",
    video: VIDEO_BASE + "startasl/mp4/like.mp4",
    hint: "Put an open hand on your chest, then pull it away while pinching your thumb and middle finger together.",
  },
  {
    word: "GOOD", emoji: "\u{1F60C}", slug: "good",
    video: VIDEO_BASE + "startasl/mp4/good.mp4",
    hint: "Touch the fingertips of a flat hand to your chin, then move it down onto your other palm.",
  },
  {
    word: "WHO", emoji: "\u{1F9D0}", slug: "who",
    video: VIDEO_BASE + "startasl/mp4/who.mp4",
    hint: "Rest your thumb on your chin and wiggle your bent index finger.",
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
