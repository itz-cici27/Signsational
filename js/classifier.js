// Two ways to recognize letters:
// 1. MLP: the neural network trained by train.py (model/model.json). Best accuracy.
// 2. kNN: quick-start mode that compares your hand to samples recorded in this
//    browser. Works the moment you record data, before anyone runs Python.
import { loadSamples } from "./store.js";

function softmax(z) {
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

export class MLP {
  constructor(json) {
    this.kind = "mlp";
    this.labels = json.labels;
    this.mean = json.mean;
    this.scale = json.scale;
    this.layers = json.layers; // [{ W: [inputs][outputs], b: [outputs] }, ...]
    this.info = json.eval || null;
  }

  probabilities(x) {
    let h = x.map((v, i) => (v - this.mean[i]) / this.scale[i]);
    this.layers.forEach((layer, li) => {
      const out = layer.b.slice();
      for (let i = 0; i < h.length; i++) {
        const hi = h[i];
        if (hi === 0) continue;
        const row = layer.W[i];
        for (let j = 0; j < out.length; j++) out[j] += hi * row[j];
      }
      const isLast = li === this.layers.length - 1;
      h = isLast ? out : out.map((v) => (v > 0 ? v : 0)); // ReLU on hidden layers
    });
    return softmax(h);
  }

  predict(x) {
    const p = this.probabilities(x);
    let best = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    return { label: this.labels[best], conf: p[best] };
  }
}

export class KNN {
  constructor(samples, k = 7) {
    this.kind = "knn";
    this.k = k;
    this.X = samples.map((s) => s.f);
    this.y = samples.map((s) => s.label);
    this.labels = [...new Set(this.y)].sort();
  }

  predict(x) {
    const nearest = []; // [distance, index], kept sorted, at most k long
    for (let n = 0; n < this.X.length; n++) {
      const row = this.X[n];
      let d = 0;
      for (let i = 0; i < row.length; i++) {
        const t = row[i] - x[i];
        d += t * t;
      }
      if (nearest.length < this.k || d < nearest[nearest.length - 1][0]) {
        nearest.push([d, n]);
        nearest.sort((a, b) => a[0] - b[0]);
        if (nearest.length > this.k) nearest.pop();
      }
    }
    const votes = {};
    for (const [, n] of nearest) votes[this.y[n]] = (votes[this.y[n]] || 0) + 1;
    let label = null;
    let count = 0;
    for (const [l, v] of Object.entries(votes)) {
      if (v > count) {
        label = l;
        count = v;
      }
    }
    return { label, conf: nearest.length ? count / nearest.length : 0 };
  }
}

export async function loadClassifier() {
  try {
    const res = await fetch("model/model.json", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.layers) return new MLP(json);
    }
  } catch {
    // no trained model yet; fall through to quick-start mode
  }
  const samples = loadSamples();
  if (samples.length >= 20) return new KNN(samples);
  return null;
}
