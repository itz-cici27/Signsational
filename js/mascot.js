// Mochi, the cheering mascot. States are CSS classes on the wrapper:
// "" (idle), "is-cheer" (arms up, hop), "is-think" (little "o" mouth).
export function mascotSVG() {
  return `
<svg class="mascot" viewBox="0 0 120 112" aria-hidden="true" focusable="false">
  <ellipse class="m-shadow" cx="60" cy="106" rx="34" ry="5"/>
  <g class="m-body">
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
  </g>
</svg>`;
}
