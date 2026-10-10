// Mochi, the cheering mascot. States are CSS classes on the wrapper:
// "" (idle), "is-cheer" (arms up, hop), "is-think" (little "o" mouth).
// Accessories are SVG snippets toggled by the shop system.

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

export function mascotSVG(equipped = []) {
  const has = (id) => equipped.includes(id);
  const behind = BEHIND.filter(has).map(id => ACCESSORIES[id]).join("\n    ");
  const onTop = ON_TOP.filter(has).map(id => ACCESSORIES[id]).join("\n    ");

  return `
<svg class="mascot" viewBox="0 0 120 112" aria-hidden="true" focusable="false">
  <ellipse class="m-shadow" cx="60" cy="106" rx="34" ry="5"/>
  <g class="m-body">
    ${behind}
    <g class="m-arm m-arm-l"><ellipse cx="22" cy="72" rx="9" ry="14"/></g>
    <g class="m-arm m-arm-r"><ellipse cx="98" cy="72" rx="9" ry="14"/></g>
    <path class="m-blob" d="M60 20c28 0 44 22 44 48 0 22-18 34-44 34S16 90 16 68c0-26 16-48 44-48z"/>
    <path class="m-sprout" d="M60 20c-2-9 3-15 11-16-1 8-5 13-11 16z"/>
    <circle class="m-eye" cx="46" cy="62" r="5.5"/>
    <circle class="m-eye" cx="74" cy="62" r="5.5"/>
    <circle class="m-shine" cx="48" cy="60" r="1.8"/>
    <circle class="m-shine" cx="76" cy="60" r="1.8"/>
    <ellipse class="m-cheek" cx="35" cy="74" rx="6.5" ry="3.5"/>
    <ellipse class="m-cheek" cx="85" cy="74" rx="6.5" ry="3.5"/>
    <path class="m-mouth m-smile" d="M52 74q8 8 16 0"/>
    <ellipse class="m-wow" cx="60" cy="77" rx="4" ry="5"/>
    ${onTop}
  </g>
</svg>`;
}
