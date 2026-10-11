// Sound effects made with the Web Audio API (no sound files to download).
// Used by the mystery boxes (js/mystery-box.js). Every sound respects the
// "Sound" setting: callers pass enabled = settings.sound.

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    // A gentle limiter so stacked notes never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 8;
    master = ctx.createGain();
    master.gain.value = 1.6; // about as loud as the letter chime in js/game.js
    master.connect(limiter).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

const hz = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

// One note with a quick attack and a smooth fade. `slideTo` bends the pitch.
function note(freq, start, length, { type = "square", volume = 0.12, slideTo } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

// A short burst of filtered noise: the "pop" when the lid flies off.
function pop(start, volume = 0.35) {
  const length = 0.18;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, start);
  filter.frequency.exponentialRampToValueAtTime(400, start + length);
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(master);
  src.start(start);
}

// Tap the box: a rising 8-bit "charging up" run, about as long as the lid animation.
export function playBoxCharge(enabled) {
  if (!enabled) return;
  try {
    const t = audio().currentTime;
    // C major arpeggio climbing two octaves, faster as it goes
    const steps = [-9, -5, -2, 3, 7, 10, 15, 19];
    let at = t;
    steps.forEach((s, i) => {
      const len = 0.07 - i * 0.004;
      note(hz(s), at, len + 0.03, { type: "square", volume: 0.07 + i * 0.006 });
      at += len;
    });
    // a soft whoosh under it
    note(hz(-21), t, 0.45, { type: "triangle", volume: 0.08, slideTo: hz(3) });
  } catch {
    // sound is optional
  }
}

// How big the reveal fanfare is for each rarity.
const FANFARE = {
  common:    { notes: [3, 7, 10],                 sparkles: 0,  bass: false },
  uncommon:  { notes: [3, 7, 10, 15],             sparkles: 3,  bass: false },
  rare:      { notes: [3, 7, 10, 15, 19],         sparkles: 6,  bass: true },
  epic:      { notes: [3, 7, 10, 15, 19, 22],     sparkles: 9,  bass: true },
  legendary: { notes: [3, 7, 10, 15, 19, 22, 27], sparkles: 14, bass: true, finale: true },
};

// The prize appears: a pop, then a power-up fanfare that gets bigger with rarity.
export function playBoxReveal(rarity, enabled) {
  if (!enabled) return;
  try {
    const t = audio().currentTime;
    const f = FANFARE[rarity] || FANFARE.common;
    pop(t);
    if (f.bass) note(hz(-21), t, 0.6, { type: "triangle", volume: 0.18, slideTo: hz(-33) });

    // bright arpeggio up the scale
    f.notes.forEach((s, i) => note(hz(s), t + 0.05 + i * 0.07, 0.22, { type: "square", volume: 0.08 }));
    const end = t + 0.05 + f.notes.length * 0.07;

    // the top note held as a chord, so it lands like a "ta-da"
    const top = f.notes[f.notes.length - 1];
    [top - 12, top - 5, top].forEach((s) =>
      note(hz(s), end, f.finale ? 1.1 : 0.45, { type: "triangle", volume: 0.09 }));

    // high glittery twinkles scattered over the chord
    for (let i = 0; i < f.sparkles; i++) {
      const s = 27 + [0, 4, 7, 12][i % 4];
      note(hz(s), end + 0.04 + i * 0.05 + Math.random() * 0.03, 0.12, { type: "sine", volume: 0.05 });
    }

    // Legendary only: a second, higher "ta-da" after a beat
    if (f.finale) {
      [top, top + 4, top + 7].forEach((s) =>
        note(hz(s), end + 0.45, 0.9, { type: "square", volume: 0.05 }));
    }
  } catch {
    // sound is optional
  }
}
