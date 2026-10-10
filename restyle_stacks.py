#!/usr/bin/env python3
"""Redesigns the Review practice stacks as fanned decks of letter cards,
with clearer wording, and (re)installs their styles.

Run from the project folder (the one with index.html):
    python3 restyle_stacks.py

It checks the spot it edits first. If it can't find it, it changes nothing.
Undo with:  git restore js/game.js css/style.css
"""
import sys
from pathlib import Path

START = '    note.className = "review-stacks-note";'
END = '    box.append(title, note, list);'

NEW_REGION = r'''    note.className = "review-stacks-note";
    note.textContent = "Choose a stack to practice. Start with the letters that need the most attention; the last stack can wait.";
    const list = document.createElement("ul");
    list.className = "deck-list";
    const stats = progress.stats || {};
    const PRIORITY = ["Start here", "Next up", "Can wait for now"];

    stacks.forEach((letters, i) => {
      const times = letters.map((l) => stats[l]?.avgTime || 0).filter((t) => t > 0);
      const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      const meta = `${letters.length} letter${letters.length === 1 ? "" : "s"}${avg ? ` \u00B7 ${avg.toFixed(1)}s avg` : ""}`;
      const label = PRIORITY[i] || PRIORITY[PRIORITY.length - 1];

      // A fanned hand of letter cards: the hardest letter is on the left.
      const cards = letters
        .map((l, k) => `<span class="deck-card" style="--i:${k}"><b>${l}</b></span>`)
        .join("");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `deck deck-${i + 1}`;
      btn.innerHTML = `
        <span class="deck-label">${label}</span>
        <span class="deck-cards" style="--n:${letters.length}" aria-hidden="true">${cards}</span>
        <span class="deck-meta">${meta}</span>`;
      btn.setAttribute("aria-label", `${label}: ${letters.join(", ")}. ${meta}.`);
      btn.addEventListener("click", () => startReviewStack(letters));
      const li = document.createElement("li");
      li.append(btn);
      list.append(li);
    });
    box.append(title, note, list);'''

CSS_MARK = "/* ===== review practice: decks of letter cards ===== */"
CSS = CSS_MARK + r'''
.review-stacks { margin: 0 0 2rem; }
.review-stacks-note { margin: 0.25rem 0 1.25rem; color: var(--muted); max-width: 60ch; }
.deck-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 1.5rem; }
.deck {
  display: grid;
  gap: 0.6rem;
  justify-items: start;
  min-width: 240px;
  padding: 1rem 1.2rem 0.9rem;
  text-align: left;
  font: inherit;
  color: var(--ink);
  background: var(--white);
  border: 3px solid var(--ink);
  border-radius: 24px;
  box-shadow: 0 5px 0 var(--ink);
  cursor: pointer;
  transition: transform 80ms ease, box-shadow 80ms ease;
}
.deck:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--ink); }
.deck-label { font-family: var(--display); font-weight: 600; font-size: 1.05rem; }
.deck-1 .deck-label { color: var(--danger); }
.deck-3 { background: transparent; border-style: dashed; box-shadow: none; color: var(--muted); }
.deck-3 .deck-label { color: var(--muted); }
.deck-meta { font-size: 0.9rem; color: var(--muted); }

/* the fan of cards */
.deck-cards {
  position: relative;
  display: block;
  height: 94px;
  width: calc(72px + (var(--n) - 1) * 42px);
  margin: 0.3rem 0.3rem 0.15rem 0;
}
.deck-card {
  position: absolute;
  bottom: 0;
  left: calc(var(--i) * 42px);
  z-index: var(--i);
  width: 72px;
  height: 82px;
  padding: 6px 0 0 9px;
  background: var(--white);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 0 3px 0 var(--ink);
  transform-origin: 50% 100%;
  transform: rotate(calc((var(--i) - (var(--n) - 1) / 2) * 3deg));
}
.deck-card:nth-child(5n+2) { background: var(--mint); }
.deck-card:nth-child(5n+3) { background: var(--sun); }
.deck-card:nth-child(5n+4) { background: #FFD3E6; }
.deck-card:nth-child(5n+5) { background: #E4DAFF; }
.deck-card b { font-family: var(--display); font-weight: 700; font-size: 1.6rem; line-height: 1; }

@media (max-width: 600px) {
  .deck { width: 100%; }
}
'''


def fail(msg):
    print("\nNothing was changed.\n" + msg)
    sys.exit(1)


game, css = Path("js/game.js"), Path("css/style.css")
for f in (game, css):
    if not f.exists():
        fail(f"Can't find {f}. Run this from the project folder (the one with index.html).")
g, c = game.read_text(), css.read_text()

if "deck-cards" in g:
    print("game.js already has the new stack design.")
else:
    if g.count(START) != 1 or g.count(END) != 1 or g.index(START) > g.index(END):
        fail("Couldn't find the review stacks code in js/game.js (expected one copy).\n"
             "Send me your current js/game.js and I'll adjust.")
    a, b = g.index(START), g.index(END) + len(END)
    game.write_text(g[:a] + NEW_REGION + g[b:])
    print("Updated js/game.js (new stack design and wording).")

if CSS_MARK in c:
    print("css/style.css already has the new styles.")
else:
    css.write_text(c.rstrip("\n") + "\n\n" + CSS)
    print("Added the stack styles to css/style.css.")
print("\nHard refresh (Cmd+Shift+R) and open the Review tab.")
