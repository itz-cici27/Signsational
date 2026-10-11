// Mystery boxes in Mochi's Shop.
// Each box costs coins and gives one random accessory the player doesn't own yet.
// The chances are always shown on the box, and you never get a duplicate.
// js/game.js calls mysteryBoxSection() from renderShop() and openMysteryBox() on click.

import { SHOP_ITEMS, SHOP_RARITIES } from "./letters.js";
import { playBoxCharge, playBoxReveal } from "./sfx.js";

// Chances are in percent and add up to 100. Change names, prices and odds here.
export const MYSTERY_BOXES = [
  {
    id: "sprout", name: "Sprout Box", price: 40, blurb: "A little surprise to start",
    colors: { body: "#BDF0D8", lid: "#9BE8C8", ribbon: "#FF6FAE" },
    odds: { common: 70, uncommon: 30 },
  },
  {
    id: "bloom", name: "Bloom Box", price: 120, blurb: "Better odds for rare items",
    colors: { body: "#C9DDF7", lid: "#A9C8FF", ribbon: "#FFD23F" },
    odds: { uncommon: 50, rare: 40, epic: 10 },
  },
  {
    id: "moonlight", name: "Moonlight Box", price: 350, blurb: "The only box with Legendary items",
    colors: { body: "#D9C6F5", lid: "#CDB4F5", ribbon: "#FF6FAE" },
    odds: { rare: 45, epic: 40, legendary: 15 }, special: true,
  },
];

const INK = "#2B1B4A";
const rarityOf = (id) => SHOP_RARITIES.find((r) => r.id === id) || { id, label: id, color: "#7a8b99" };
const COIN = `<img class="coin-icon" src="assets/coin.png" alt="" aria-hidden="true">`;

// A gift box with Mochi's face. The lid has its own class so it can pop open.
export function boxSVG(box) {
  const { body, lid, ribbon } = box.colors;
  return `<svg class="mb-art" viewBox="0 0 120 110" aria-hidden="true" focusable="false">
    <ellipse cx="60" cy="104" rx="40" ry="5" fill="${INK}" opacity=".12"/>
    <rect x="18" y="44" width="84" height="56" rx="12" fill="${body}" stroke="${INK}" stroke-width="4"/>
    <rect x="53" y="44" width="14" height="56" fill="${ribbon}" stroke="${INK}" stroke-width="3"/>
    <circle cx="38" cy="72" r="4.5" fill="${INK}"/><circle cx="82" cy="72" r="4.5" fill="${INK}"/>
    <ellipse cx="30" cy="82" rx="5" ry="3" fill="#FF6FAE" opacity=".8"/><ellipse cx="90" cy="82" rx="5" ry="3" fill="#FF6FAE" opacity=".8"/>
    <g class="mb-lid">
      <rect x="12" y="30" width="96" height="20" rx="8" fill="${lid}" stroke="${INK}" stroke-width="4"/>
      <rect x="53" y="30" width="14" height="20" fill="${ribbon}" stroke="${INK}" stroke-width="3"/>
      <path d="M60 30C50 14 34 16 38 26C41 32 52 31 60 30zM60 30C70 14 86 16 82 26C79 32 68 31 60 30z" fill="${ribbon}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

// Items this box can still give, grouped by rarity (only rarities that have something left).
function prizePool(box, owned) {
  const pool = [];
  for (const [rarity, chance] of Object.entries(box.odds)) {
    const items = SHOP_ITEMS.filter((i) => i.rarity === rarity && !owned.includes(i.id));
    if (items.length && chance > 0) pool.push({ rarity, chance, items });
  }
  return pool;
}

export const boxIsEmpty = (box, owned) => prizePool(box, owned).length === 0;

// Pick a rarity using the box's chances, then a random item of that rarity.
// If a rarity is already fully collected, its chance is shared out among the others.
export function pickPrize(box, owned) {
  const pool = prizePool(box, owned);
  if (!pool.length) return null;
  const total = pool.reduce((sum, p) => sum + p.chance, 0);
  let roll = Math.random() * total;
  let group = pool[pool.length - 1];
  for (const p of pool) {
    if (roll < p.chance) { group = p; break; }
    roll -= p.chance;
  }
  return group.items[Math.floor(Math.random() * group.items.length)];
}

// The "Mystery Boxes" section at the top of the shop.
export function mysteryBoxSection({ coins, owned, onOpen }) {
  const section = document.createElement("div");
  section.className = "shop-section mb-section";
  section.innerHTML = `
    <div class="mb-head"><h3 class="shop-rarity">Mystery Boxes</h3><span class="mb-new">NEW</span></div>
    <p class="mb-note">Open a box for a surprise accessory. You never get something you already own, and the chances are always shown.</p>`;
  const grid = document.createElement("div");
  grid.className = "mb-grid";

  MYSTERY_BOXES.forEach((box) => {
    const empty = boxIsEmpty(box, owned);
    const canAfford = coins >= box.price;
    const odds = Object.entries(box.odds).map(([id, pct]) => ({ ...rarityOf(id), pct }));
    const card = document.createElement("button");
    card.type = "button";
    card.className = "mb-card" + (box.special ? " is-special" : "");
    card.disabled = empty || !canAfford;
    const oddsText = odds.map((o) => `${o.label} ${o.pct}%`).join(", ");
    card.setAttribute("aria-label",
      `${box.name}. ${box.blurb}. Chances: ${oddsText}. ` +
      (empty ? "You've collected everything in this box." : `${box.price} coins.`));
    card.innerHTML = `
      ${box.special ? '<span class="mb-sparkle mb-sparkle-a" aria-hidden="true">✨</span><span class="mb-sparkle mb-sparkle-b" aria-hidden="true">✨</span>' : ""}
      ${boxSVG(box)}
      <span class="mb-name">${box.name}</span>
      <span class="mb-blurb">${box.blurb}</span>
      <span class="mb-odds" aria-hidden="true">${odds.map((o) => `<span style="width:${o.pct}%;background:${o.color}"></span>`).join("")}</span>
      <span class="mb-legend" aria-hidden="true">${odds.map((o) => `<span><i style="background:${o.color}"></i>${o.label} ${o.pct}%</span>`).join("")}</span>
      <span class="mb-buy${empty || !canAfford ? " is-off" : ""}">${empty ? "All collected!" : `${COIN} ${canAfford ? "Open · " : ""}${box.price}`}</span>`;
    card.addEventListener("click", () => onOpen(box));
    grid.append(card);
  });

  section.append(grid);
  return section;
}

// The opening dialog: the box wiggles, the player taps it, and the prize appears.
// The prize is already saved before this is shown, so closing early loses nothing.
// `sound` is the player's Sound setting: a power-up charge on tap, then a fanfare
// that gets bigger with the prize's rarity (js/sfx.js).
export function showMysteryBox(box, item, { onEquip, sound = true }) {
  document.getElementById("mysteryDialog")?.remove();
  const rarity = rarityOf(item.rarity);
  const dlg = document.createElement("dialog");
  dlg.id = "mysteryDialog";
  dlg.className = "mb-dialog";
  dlg.setAttribute("aria-labelledby", "mbTitle");
  dlg.innerHTML = `
    <div class="mb-step mb-step-open">
      <h2 id="mbTitle" class="mb-opening">Opening ${box.name}...</h2>
      <button type="button" class="mb-tap" id="mbTap" aria-label="Open the box">${boxSVG(box)}</button>
      <p class="mb-tap-hint">Tap the box to open it!</p>
    </div>`;
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());

  const reveal = () => {
    const colors = ["#FF6FAE", "#FFD23F", "#9BE8C8", "#CDB4F5", "#A9C8FF"];
    const bits = Array.from({ length: 22 }, (_, i) =>
      `<span class="mb-confetti" style="left:${(i * 37) % 100}%;top:${(i * 53) % 60}%;background:${colors[i % 5]};--r:${i * 41}deg;animation-delay:${(i % 6) * 60}ms"></span>`).join("");
    dlg.innerHTML = `
      <div class="mb-step mb-step-reveal">
        <div class="mb-rays" aria-hidden="true"></div>
        <div class="mb-confetti-wrap" aria-hidden="true">${bits}</div>
        <div class="mb-prize" aria-hidden="true">${item.emoji}</div>
        <span class="mb-tier" style="background:${rarity.color}">${rarity.label}</span>
        <h2 id="mbTitle">You got the ${item.name}!</h2>
        <p class="mb-prize-desc">${item.description}. It's in your collection now.</p>
        <div class="dialog-actions mb-actions">
          <button class="btn" type="button" id="mbEquip">Put it on Mochi</button>
          <button class="btn btn-quiet" type="button" id="mbBack">Back to shop</button>
        </div>
      </div>`;
    dlg.querySelector("#mbEquip").addEventListener("click", () => { onEquip(item.id); dlg.close(); });
    dlg.querySelector("#mbBack").addEventListener("click", () => dlg.close());
    dlg.querySelector("#mbEquip").focus();
    playBoxReveal(item.rarity, sound);
  };

  const tap = dlg.querySelector("#mbTap");
  tap.addEventListener("click", () => {
    tap.classList.add("is-opening");
    playBoxCharge(sound);
    setTimeout(reveal, 450);
  }, { once: true });
  dlg.showModal();
  tap.focus();
}
