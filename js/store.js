// Everything is saved in this browser only (localStorage). Nothing is uploaded.

export function getItem(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

export const DEFAULT_SETTINGS = {
  leftHanded: false,
  strictness: "normal", // easy | normal | strict
  sound: false,
  bigText: false,
  unlockAll: false,
};

export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...getItem("sls_settings", {}) });
export const saveSettings = (s) => setItem("sls_settings", s);

export const loadProgress = () => ({ completed: [], streak: 0, lastDay: null, coins: 0, wordsCompleted: [], ...getItem("sls_progress", {}) });
export const saveProgress = (p) => setItem("sls_progress", p);

export const loadShop = () => ({ owned: [], equipped: [], flavor: "matcha", ...getItem("sls_shop", {}) });
export const saveShop = (s) => setItem("sls_shop", s);

export const loadSamples = () => getItem("sls_samples", []);
export const saveSamples = (s) => setItem("sls_samples", s);

export function dayKey(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

// Call when the learner gets a letter right.
export function bumpStreak(p) {
  const today = dayKey();
  if (p.lastDay === today) return p;
  p.streak = p.lastDay === yesterdayKey() ? p.streak + 1 : 1;
  p.lastDay = today;
  return p;
}

// Streak shown in the header (resets to 0 if a day was missed).
export function currentStreak(p) {
  return p.lastDay === dayKey() || p.lastDay === yesterdayKey() ? p.streak : 0;
}
