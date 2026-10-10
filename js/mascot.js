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
};

// Cape renders behind the body; everything else renders on top of facial features.
const BEHIND = ["cape"];
const ON_TOP = ["scarf", "star", "sunglasses", "bow", "partyhat", "flower", "crown"];

// Accessories are drawn for the original 120x112 Mochi. FIT maps them onto the bigger,
// cuter body (180x150); a few get their own fit so they land on the eyes, chin, etc.
const FIT = "translate(6 4) scale(1.4)";
const FIT_FOR = {
  sunglasses: "translate(12.6 8) scale(1.29)",
  scarf: "translate(6 -6) scale(1.4)",
  star: "translate(18 -3) scale(1.2)",
  cape: "translate(-12 4) scale(1.7 1.3)",
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
