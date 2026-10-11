// Mochi, the cheering mascot: a squishy mint rice cake with big sparkly eyes.
// States are CSS classes on the wrapper (see setMascot in game.js):
//   ""          idle: bobs gently and blinks
//   "is-close"  the learner is almost there: wide eyes, sparkles, little wiggle
//   "is-cheer"  success: arms up, happy ^^ eyes, hop, sparkles
//   "is-think"  encouraging nudge: little "o" mouth, head tilt
// Accessories are SVG snippets toggled by the shop system.
// Flavors recolor Mochi through CSS variables (--mochi, --mochi-cheek) set on <html data-flavor>.

// Free to pick. Colors live in css/style.css under html[data-flavor="..."]; `body` here is only
// used to draw the swatch in the flavor picker.
export const FLAVORS = [
  { id: "matcha", name: "Matcha", body: "#9BE8C8" },
  { id: "strawberry", name: "Strawberry", body: "#FFB8D2" },
  { id: "mango", name: "Mango", body: "#FFD98A" },
  { id: "ube", name: "Ube", body: "#CDB4F5" },
  { id: "blueberry", name: "Blueberry", body: "#A9C8FF" },
  { id: "peach", name: "Peach", body: "#FFC2A3" },
  { id: "vanilla", name: "Vanilla", body: "#FFF3D6" },
  { id: "sesame", name: "Black Sesame", body: "#C9C3D3" },
];

export function applyFlavor(id) {
  const known = FLAVORS.some((f) => f.id === id);
  document.documentElement.dataset.flavor = known ? id : "matcha";
}

const ACCESSORIES = {
  cape: `<path class="m-acc" d="M36 52c-12 18-14 42 0 50l48 0c14-8 12-32 0-50" fill="#9B59B6" stroke="var(--ink)" stroke-width="2.5" opacity="0.8"/>`,

  bow: `<g class="m-acc">
    <ellipse cx="51" cy="16" rx="9" ry="5" fill="var(--pink)" stroke="var(--ink)" stroke-width="2" transform="rotate(-15 51 16)"/>
    <ellipse cx="69" cy="16" rx="9" ry="5" fill="var(--pink)" stroke="var(--ink)" stroke-width="2" transform="rotate(15 69 16)"/>
    <circle cx="60" cy="17" r="3.5" fill="var(--pink)" stroke="var(--ink)" stroke-width="2"/>
  </g>`,

  sunglasses: `<g class="m-acc">
    <rect x="36" y="56" width="17" height="12" rx="5" fill="var(--ink)" opacity="0.85"/>
    <rect x="67" y="56" width="17" height="12" rx="5" fill="var(--ink)" opacity="0.85"/>
    <line x1="53" y1="62" x2="67" y2="62" stroke="var(--ink)" stroke-width="2.5"/>
    <line x1="36" y1="60" x2="28" y2="57" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="84" y1="60" x2="92" y2="57" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
  </g>`,

  star: `<g class="m-acc">
    <polygon points="60,40 63,48 72,48 65,53 67,62 60,57 53,62 55,53 48,48 57,48" fill="var(--sun)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
  </g>`,

  scarf: `<g class="m-acc">
    <path d="M32 90q28 8 56 0" fill="none" stroke="#E74C3C" stroke-width="7" stroke-linecap="round"/>
    <path d="M32 90q28 8 56 0" fill="none" stroke="#C0392B" stroke-width="4" stroke-linecap="round" stroke-dasharray="4 8"/>
    <rect x="54" y="90" width="10" height="14" rx="3" fill="#E74C3C" stroke="var(--ink)" stroke-width="2"/>
  </g>`,

  partyhat: `<g class="m-acc">
    <path d="M60 0 L46 22 L74 22 Z" fill="var(--sun)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="52" y1="15" x2="54" y2="7" stroke="var(--pink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="63" y1="12" x2="64" y2="5" stroke="var(--mint)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="60" cy="0" r="3" fill="var(--pink)" stroke="var(--ink)" stroke-width="1.5"/>
  </g>`,

  flower: `<g class="m-acc">
    <circle cx="40" cy="26" r="5.5" fill="var(--pink)" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="50" cy="22" r="5" fill="var(--sun)" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="60" cy="20" r="5.5" fill="var(--pink)" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="70" cy="22" r="5" fill="var(--sun)" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="80" cy="26" r="5.5" fill="var(--pink)" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="40" cy="26" r="2" fill="var(--sun)"/>
    <circle cx="50" cy="22" r="2" fill="var(--pink)"/>
    <circle cx="60" cy="20" r="2" fill="var(--sun)"/>
    <circle cx="70" cy="22" r="2" fill="var(--pink)"/>
    <circle cx="80" cy="26" r="2" fill="var(--sun)"/>
  </g>`,

  crown: `<g class="m-acc">
    <path d="M40 24 L40 14 L47 20 L53.5 10 L60 20 L66.5 10 L73 20 L80 14 L80 24 Z" fill="var(--sun)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="47" cy="22" r="1.5" fill="var(--pink)"/>
    <circle cx="60" cy="22" r="1.5" fill="var(--pink)"/>
    <circle cx="73" cy="22" r="1.5" fill="var(--pink)"/>
  </g>`,

  heart: `<g class="m-acc">
    <path d="M60 30 C60 24 50 18 50 24 C50 30 60 38 60 38 C60 38 70 30 70 24 C70 18 60 24 60 30Z" fill="#E74C3C" stroke="var(--ink)" stroke-width="2"/>
  </g>`,

  leaf: `<g class="m-acc">
    <path d="M60 10 Q68 16 66 26 Q60 22 54 26 Q52 16 60 10Z" fill="var(--mint-deep)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <line x1="60" y1="12" x2="60" y2="24" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round"/>
  </g>`,

  headband: `<g class="m-acc">
    <path d="M34 38 Q60 28 86 38" fill="none" stroke="#E74C3C" stroke-width="6" stroke-linecap="round"/>
    <path d="M34 38 Q60 28 86 38" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  </g>`,

  tophat: `<g class="m-acc">
    <ellipse cx="60" cy="24" rx="22" ry="4" fill="var(--ink)" stroke="var(--ink)" stroke-width="2"/>
    <rect x="46" y="4" width="28" height="20" rx="2" fill="var(--ink)" stroke="var(--ink)" stroke-width="2"/>
    <rect x="46" y="16" width="28" height="4" fill="var(--sun)" opacity="0.7"/>
  </g>`,

  butterfly: `<g class="m-acc">
    <ellipse cx="44" cy="18" rx="12" ry="8" fill="#A9C8FF" stroke="var(--ink)" stroke-width="2" opacity="0.85" transform="rotate(-10 44 18)"/>
    <ellipse cx="76" cy="18" rx="12" ry="8" fill="#CDB4F5" stroke="var(--ink)" stroke-width="2" opacity="0.85" transform="rotate(10 76 18)"/>
    <ellipse cx="48" cy="24" rx="7" ry="5" fill="#FFB8D2" stroke="var(--ink)" stroke-width="1.5" opacity="0.8"/>
    <ellipse cx="72" cy="24" rx="7" ry="5" fill="#FFD98A" stroke="var(--ink)" stroke-width="1.5" opacity="0.8"/>
    <ellipse cx="60" cy="20" rx="2" ry="6" fill="var(--ink)"/>
  </g>`,

  wizard: `<g class="m-acc">
    <path d="M60 -6 L44 26 L76 26 Z" fill="#9B59B6" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="56" cy="16" r="2" fill="var(--sun)"/>
    <circle cx="64" cy="10" r="1.5" fill="var(--sun)"/>
    <circle cx="60" cy="20" r="1.5" fill="var(--sun)"/>
    <path d="M44 26 Q60 30 76 26" fill="var(--ink)" stroke="var(--ink)" stroke-width="2"/>
  </g>`,

  halo: `<g class="m-acc">
    <ellipse cx="60" cy="12" rx="18" ry="5" fill="none" stroke="var(--sun)" stroke-width="4" opacity="0.9"/>
    <ellipse cx="60" cy="12" rx="18" ry="5" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.5"/>
  </g>`,

  rainbow: `<g class="m-acc" opacity="0.7">
    <path d="M30 8 Q60 -8 90 8" fill="none" stroke="#E74C3C" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 12 Q60 -4 88 12" fill="none" stroke="#FF8A65" stroke-width="3" stroke-linecap="round"/>
    <path d="M34 16 Q60 0 86 16" fill="none" stroke="var(--sun)" stroke-width="3" stroke-linecap="round"/>
    <path d="M36 20 Q60 4 84 20" fill="none" stroke="var(--mint-deep)" stroke-width="3" stroke-linecap="round"/>
    <path d="M38 24 Q60 8 82 24" fill="none" stroke="#4A90D9" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 28 Q60 12 80 28" fill="none" stroke="#9B59B6" stroke-width="3" stroke-linecap="round"/>
  </g>`,

  dragon: `<g class="m-acc">
    <path d="M42 26 Q38 8 44 4 Q48 10 46 22" fill="#9B59B6" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M78 26 Q82 8 76 4 Q72 10 74 22" fill="#9B59B6" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="44" cy="6" r="2" fill="var(--sun)"/>
    <circle cx="76" cy="6" r="2" fill="var(--sun)"/>
  </g>`,

  cherry: `<g class="m-acc">
    <path d="M58 8 Q54 2 60 0 Q66 2 62 8" fill="none" stroke="var(--mint-deep)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="55" cy="12" r="5" fill="#E74C3C" stroke="var(--ink)" stroke-width="2"/>
    <circle cx="65" cy="12" r="5" fill="#E74C3C" stroke="var(--ink)" stroke-width="2"/>
    <ellipse cx="53" cy="10" rx="1.5" ry="1" fill="#fff" opacity="0.6"/>
    <ellipse cx="63" cy="10" rx="1.5" ry="1" fill="#fff" opacity="0.6"/>
  </g>`,

  balloon: `<g class="m-acc">
    <line x1="76" y1="30" x2="78" y2="0" stroke="var(--muted)" stroke-width="1.5"/>
    <ellipse cx="78" cy="-6" rx="8" ry="10" fill="var(--pink)" stroke="var(--ink)" stroke-width="2"/>
    <ellipse cx="76" cy="-10" rx="2.5" ry="1.5" fill="#fff" opacity="0.5"/>
  </g>`,

  beret: `<g class="m-acc">
    <ellipse cx="60" cy="22" rx="24" ry="6" fill="var(--ink)"/>
    <ellipse cx="58" cy="18" rx="20" ry="10" fill="#E74C3C" stroke="var(--ink)" stroke-width="2"/>
    <circle cx="60" cy="8" r="3" fill="#E74C3C" stroke="var(--ink)" stroke-width="1.5"/>
  </g>`,

  music: `<g class="m-acc">
    <path d="M32 52 Q32 44 40 44 L40 56 Q40 62 34 62 Q28 62 28 58 Q28 54 34 54" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
    <path d="M88 52 Q88 44 80 44 L80 56 Q80 62 86 62 Q92 62 92 58 Q92 54 86 54" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
    <path d="M34 42 Q60 34 86 42" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
    <path d="M34 42 Q60 34 86 42" fill="none" stroke="var(--pink)" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  </g>`,

  tiara: `<g class="m-acc">
    <path d="M38 24 L44 14 L50 20 L56 10 L60 18 L64 10 L70 20 L76 14 L82 24" fill="none" stroke="#4A90D9" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="56" cy="10" r="2.5" fill="#4A90D9" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="64" cy="10" r="2.5" fill="#4A90D9" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="60" cy="18" r="3" fill="var(--sun)" stroke="var(--ink)" stroke-width="1.5"/>
  </g>`,

  antenna: `<g class="m-acc">
    <line x1="50" y1="24" x2="46" y2="4" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="70" y1="24" x2="74" y2="4" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="46" cy="2" r="4" fill="#9BE8C8" stroke="var(--ink)" stroke-width="2"/>
    <circle cx="74" cy="2" r="4" fill="#9BE8C8" stroke="var(--ink)" stroke-width="2"/>
  </g>`,

  flame: `<g class="m-acc">
    <path d="M52 24 Q48 10 54 2 Q58 10 60 6 Q62 10 66 2 Q72 10 68 24" fill="#FF8A65" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M55 24 Q54 14 58 8 Q60 14 62 8 Q66 14 65 24" fill="var(--sun)" stroke="none" opacity="0.8"/>
  </g>`,

  astronaut: `<g class="m-acc">
    <ellipse cx="60" cy="52" rx="24" ry="22" fill="none" stroke="var(--white)" stroke-width="6" opacity="0.5"/>
    <ellipse cx="60" cy="52" rx="24" ry="22" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
    <rect x="50" y="30" width="20" height="4" rx="2" fill="#ccc" stroke="var(--ink)" stroke-width="1.5"/>
    <ellipse cx="60" cy="36" rx="3" ry="2" fill="#4A90D9" opacity="0.5"/>
  </g>`,

  unicorn: `<g class="m-acc">
    <path d="M60 -2 L56 18 L64 18 Z" fill="var(--sun)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="58" y1="6" x2="62" y2="6" stroke="var(--pink)" stroke-width="2" stroke-linecap="round"/>
    <line x1="57" y1="10" x2="63" y2="10" stroke="#A9C8FF" stroke-width="2" stroke-linecap="round"/>
    <line x1="58" y1="14" x2="62" y2="14" stroke="#CDB4F5" stroke-width="2" stroke-linecap="round"/>
  </g>`,
};

// Cape renders behind the body; everything else renders on top of facial features.
const BEHIND = ["cape", "butterfly", "rainbow"];
const ON_TOP = ["scarf", "star", "sunglasses", "bow", "partyhat", "flower", "crown", "heart", "leaf", "headband", "tophat", "wizard", "halo", "dragon", "cherry", "balloon", "beret", "music", "tiara", "antenna", "flame", "astronaut", "unicorn"];

// Accessories are drawn for the original 120x112 Mochi. FIT maps them onto the bigger,
// cuter body (180x150); a few get their own fit so they land on the eyes, chin, etc.
const FIT = "translate(6 4) scale(1.4)";
const FIT_FOR = {
  sunglasses: "translate(12.6 8) scale(1.29)",
  scarf: "translate(6 -6) scale(1.4)",
  star: "translate(18 -3) scale(1.2)",
  cape: "translate(-12 4) scale(1.7 1.3)",
  headband: "translate(6 6) scale(1.4)",
  butterfly: "translate(-6 4) scale(1.6 1.3)",
  rainbow: "translate(0 4) scale(1.5)",
  music: "translate(12.6 4) scale(1.29)",
  astronaut: "translate(12.6 4) scale(1.29)",
};
const wear = (id) => `<g transform="${FIT_FOR[id] || FIT}">${ACCESSORIES[id]}</g>`;

export function mascotSVG(equipped = []) {
  const has = (id) => equipped.includes(id);
  const behind = BEHIND.filter(has).map(wear).join("\n    ");
  const onTop = ON_TOP.filter(has).map(wear).join("\n    ");

  return `
<svg class="mascot" viewBox="0 0 180 150" aria-hidden="true" focusable="false">
  <ellipse class="m-shadow" cx="90" cy="140" rx="54" ry="6"/>
  <g class="m-body">
    ${behind}
    <g class="m-arm m-arm-l"><ellipse cx="26" cy="102" rx="9" ry="12"/></g>
    <g class="m-arm m-arm-r"><ellipse cx="154" cy="102" rx="9" ry="12"/></g>
    <path class="m-blob" d="M90 32C132 32 156 64 156 94C156 118 128 130 90 130C52 130 24 118 24 94C24 64 48 32 90 32z"/>
    <path class="m-gloss" d="M54 60C62 48 74 43 84 42"/>
    <path class="m-sprout" d="M90 33C86 22 76 17 66 19C70 29 80 34 90 33z"/>
    <path class="m-sprout" d="M90 33C96 20 108 16 118 20C112 31 102 35 90 33z"/>
    <g class="m-eyes">
      <ellipse class="m-eye" cx="70" cy="88" rx="7.5" ry="9"/>
      <ellipse class="m-eye" cx="110" cy="88" rx="7.5" ry="9"/>
      <circle class="m-shine" cx="72.8" cy="84" r="3"/>
      <circle class="m-shine" cx="112.8" cy="84" r="3"/>
      <circle class="m-shine" cx="67.6" cy="92" r="1.4"/>
      <circle class="m-shine" cx="107.6" cy="92" r="1.4"/>
    </g>
    <g class="m-happy">
      <path d="M62 90q8-10 16 0"/>
      <path d="M102 90q8-10 16 0"/>
    </g>
    <ellipse class="m-cheek" cx="54" cy="102" rx="9.5" ry="5.5"/>
    <ellipse class="m-cheek" cx="126" cy="102" rx="9.5" ry="5.5"/>
    <path class="m-mouth m-smile" d="M82 99q4 5.5 8 0q4 5.5 8 0"/>
    <ellipse class="m-wow" cx="90" cy="102" rx="4" ry="5"/>
    ${onTop}
  </g>
  <g class="m-sparkles">
    <path class="m-sparkle m-sparkle-1" d="M24 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>
    <path class="m-sparkle m-sparkle-2" d="M158 30l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z"/>
  </g>
</svg>`;
}
