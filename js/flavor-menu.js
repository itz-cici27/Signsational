// "Flavor" tab in the top bar: opens a menu of Mochi flavors (colors) to pick from.
// Works on any page with a .topbar-right. The choice is saved in the shop data, applied
// right away to every Mochi on the page, and announced with a "mochi:flavor" event so
// game.js can sync it to the cloud.
import { FLAVORS, applyFlavor } from "./mascot.js";
import { loadShop, saveShop } from "./store.js";

const swatch = (fill) => `
  <svg class="flavor-swatch" viewBox="20 14 140 120" aria-hidden="true">
    <path d="M90 33C86 22 76 17 66 19C70 29 80 34 90 33zM90 33C96 20 108 16 118 20C112 31 102 35 90 33z" fill="#2FA87A" stroke="#2B1B4A" stroke-width="6" stroke-linejoin="round"/>
    <path d="M90 32C132 32 156 64 156 94C156 118 128 130 90 130C52 130 24 118 24 94C24 64 48 32 90 32z" fill="${fill}" stroke="#2B1B4A" stroke-width="7"/>
    <ellipse cx="70" cy="88" rx="9" ry="11" fill="#2B1B4A"/><ellipse cx="110" cy="88" rx="9" ry="11" fill="#2B1B4A"/>
  </svg>`;

const current = () => document.documentElement.dataset.flavor || loadShop().flavor || "matcha";

export function mountFlavorMenu() {
  const bar = document.querySelector(".topbar-right");
  if (!bar || document.getElementById("flavorBtn")) return;
  applyFlavor(loadShop().flavor);

  const wrap = document.createElement("div");
  wrap.className = "flavor-menu";
  wrap.innerHTML = `
    <button class="btn btn-quiet flavor-btn" id="flavorBtn" type="button"
      aria-haspopup="true" aria-expanded="false" aria-controls="flavorPanel">
      ${swatch("var(--mochi, var(--mint))")}<span class="flavor-btn-label">Flavor</span>
    </button>
    <div class="flavor-panel" id="flavorPanel" hidden>
      <p class="flavor-panel-title" id="flavorPanelTitle">Pick Mochi's flavor</p>
      <div class="flavor-options" role="radiogroup" aria-labelledby="flavorPanelTitle">
        ${FLAVORS.map((f) => `
          <button type="button" class="flavor" role="radio" data-flavor="${f.id}" aria-checked="false" tabindex="-1">
            ${swatch(f.body)}<span class="flavor-name">${f.name}</span>
          </button>`).join("")}
      </div>
    </div>`;
  bar.prepend(wrap);

  const btn = wrap.querySelector("#flavorBtn");
  const panel = wrap.querySelector("#flavorPanel");
  const options = [...wrap.querySelectorAll(".flavor")];

  const sync = () => {
    const id = current();
    options.forEach((o) => {
      const on = o.dataset.flavor === id;
      o.setAttribute("aria-checked", String(on));
      o.tabIndex = on ? 0 : -1;
    });
    const f = FLAVORS.find((x) => x.id === id);
    btn.setAttribute("aria-label", `Mochi flavor: ${f ? f.name : "Matcha"}. Change flavor`);
  };

  const open = () => {
    sync();
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    (options.find((o) => o.tabIndex === 0) || options[0]).focus();
  };
  const close = (refocus = true) => {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
  };

  const choose = (id) => {
    const shop = loadShop();
    shop.flavor = id;
    saveShop(shop);
    applyFlavor(id);
    sync();
    window.dispatchEvent(new CustomEvent("mochi:flavor", { detail: id }));
  };

  btn.addEventListener("click", () => (panel.hidden ? open() : close()));
  options.forEach((o, i) => {
    o.addEventListener("click", () => choose(o.dataset.flavor));
    o.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = options[(i + step + options.length) % options.length];
      choose(next.dataset.flavor);
      next.focus();
    });
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) close(false);
  });
  sync();
}

mountFlavorMenu();
