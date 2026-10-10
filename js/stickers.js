// Sticker book: achievement stickers. Each one is a peekaboo Mochi in the player's chosen
// flavor (Mochi and the disc behind it use two shades of the same color, via the CSS
// variables --mochi and --sticker-disc set for each flavor in css/style.css).
//
// Progress counted:
//   letters = letters learned (progress.lettersCompleted)
//   words   = words completed, counting every time: Sign Words plus each word spelled in a
//             Word Challenge (progress.wordsSigned)

export const STICKERS = [
  { id: "all-letters", label: "All 26 letters", text: "A–Z", kind: "letters", goal: 26, crown: true },
  { id: "first-letter", label: "First letter", text: "A", kind: "letters", goal: 1 },
  { id: "first-word", label: "First word", text: "1", kind: "words", goal: 1 },
  { id: "letters-5", label: "5 letters", text: "5", kind: "letters", goal: 5 },
  { id: "letters-10", label: "10 letters", text: "10", kind: "letters", goal: 10 },
  { id: "letters-20", label: "20 letters", text: "20", kind: "letters", goal: 20 },
  { id: "words-5", label: "5 words", text: "5", kind: "words", goal: 5 },
  { id: "words-10", label: "10 words", text: "10", kind: "words", goal: 10 },
  { id: "words-25", label: "25 words", text: "25", kind: "words", goal: 25 },
  { id: "words-50", label: "50 words", text: "50", kind: "words", goal: 50 },
  { id: "words-100", label: "100 words", text: "100", kind: "words", goal: 100 },
];

// How far the player has come, from saved progress.
export function stickerStats(progress) {
  return {
    letters: (progress.lettersCompleted || []).length,
    words: progress.wordsSigned ?? (progress.signsCompleted || []).length,
  };
}

export const hasSticker = (s, stats) => stats[s.kind] >= s.goal;

// Stickers that `after` has and `before` didn't: show these as "new sticker!" moments.
export const newStickers = (before, after) => STICKERS.filter((s) => hasSticker(s, after) && !hasSticker(s, before));

// Caption under a locked sticker, with progress once the player has started.
export function lockedCaption(s, stats) {
  const have = stats[s.kind];
  return have > 0 ? `${s.label} (${Math.min(have, s.goal)}/${s.goal})` : s.label;
}

let uid = 0;
export function stickerSVG(s) {
  const clip = `peek-${s.id}-${uid++}`;
  const size = s.text.length > 2 ? 26 : s.text.length > 1 ? 34 : 38;
  // Word stickers put their number in a little speech bubble; letter stickers don't.
  const label = s.kind === "words"
    ? `<path d="M36 22h48a10 10 0 0 1 10 10v10a10 10 0 0 1-10 10H66l-6 7-6-7H36a10 10 0 0 1-10-10V32a10 10 0 0 1 10-10z" fill="#FFFFFF" stroke="#2B1B4A" stroke-width="3" stroke-linejoin="round"/>
       <text x="60" y="45" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${Math.min(size, 26)}" fill="#2B1B4A">${s.text}</text>`
    : `<text x="60" y="46" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${size}" fill="#2B1B4A" opacity=".8">${s.text}</text>`;
  const crown = s.crown
    ? `<path d="M74 34l0-12 8 7 7-11 7 11 8-7 0 12z" fill="#FFD23F" stroke="#2B1B4A" stroke-width="3" stroke-linejoin="round" transform="translate(-29 38)"/>`
    : "";
  return `
<svg class="sticker-art" viewBox="0 0 120 124" aria-hidden="true" focusable="false">
  <defs><clipPath id="${clip}"><circle cx="60" cy="58" r="46"/></clipPath></defs>
  <circle cx="60" cy="66" r="56" fill="#2B1B4A"/>
  <circle cx="60" cy="58" r="56" fill="#FFFFFF" stroke="#2B1B4A" stroke-width="4"/>
  <circle cx="60" cy="58" r="46" style="fill: var(--sticker-disc, #5FD3A4)"/>
  ${label}
  <g clip-path="url(#${clip})">
    <g transform="translate(22 56) scale(0.42)">
      <path d="M90 32C132 32 156 64 156 94C156 118 128 130 90 130C52 130 24 118 24 94C24 64 48 32 90 32z" style="fill: var(--mochi, #9BE8C8)" stroke="#2B1B4A" stroke-width="8"/>
      <path d="M90 33C86 22 76 17 66 19C70 29 80 34 90 33zM90 33C96 20 108 16 118 20C112 31 102 35 90 33z" fill="#2FA87A" stroke="#2B1B4A" stroke-width="6" stroke-linejoin="round"/>
      <ellipse cx="70" cy="80" rx="10" ry="12" fill="#2B1B4A"/><ellipse cx="110" cy="80" rx="10" ry="12" fill="#2B1B4A"/>
      <circle cx="74" cy="75" r="4" fill="#FFFFFF"/><circle cx="114" cy="75" r="4" fill="#FFFFFF"/>
      <ellipse cx="50" cy="96" rx="12" ry="7" style="fill: var(--mochi-cheek, #FF6FAE)" opacity=".85"/><ellipse cx="130" cy="96" rx="12" ry="7" style="fill: var(--mochi-cheek, #FF6FAE)" opacity=".85"/>
    </g>
    ${crown}
  </g>
  <circle cx="60" cy="58" r="46" fill="none" stroke="#2B1B4A" stroke-width="3"/>
</svg>`;
}
