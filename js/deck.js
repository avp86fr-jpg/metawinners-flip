/** Flip 7–inspired deck builders. Deterministic shuffle with mulberry32. */
import { stampDeckIdentity } from './cards.js';

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Official-style composition: numbers 0–12 (n copies of n, one 0), modifiers, actions. */
export function buildDeck() {
  const cards = [];
  let id = 0;
  // One 0
  cards.push({ id: id++, kind: 'number', value: 0 });
  for (let n = 1; n <= 12; n++) {
    for (let i = 0; i < n; i++) {
      cards.push({ id: id++, kind: 'number', value: n });
    }
  }
  // Modifiers
  for (const v of [2, 4, 6, 8, 8, 10]) {
    cards.push({ id: id++, kind: 'mod', value: v });
  }
  cards.push({ id: id++, kind: 'mod', value: 'x2' });
  // Actions
  for (let i = 0; i < 3; i++) cards.push({ id: id++, kind: 'action', value: 'freeze' });
  for (let i = 0; i < 3; i++) cards.push({ id: id++, kind: 'action', value: 'flip3' });
  for (let i = 0; i < 3; i++) cards.push({ id: id++, kind: 'action', value: 'second' });
  return stampDeckIdentity(cards);
}

export function deckCounts(cards) {
  const c = { numbers: {}, mods: {}, actions: {}, total: cards.length };
  for (const card of cards) {
    if (card.kind === 'number') c.numbers[card.value] = (c.numbers[card.value] || 0) + 1;
    else if (card.kind === 'mod') c.mods[String(card.value)] = (c.mods[String(card.value)] || 0) + 1;
    else c.actions[card.value] = (c.actions[card.value] || 0) + 1;
  }
  return c;
}

export function shuffle(cards, rng = Math.random) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function expectedNumberCount() {
  // 1 zero + sum(1..12) = 1 + 78 = 79
  return 79;
}

export function expectedTotal() {
  // 79 numbers + 7 mods + 9 actions = 95
  return 95;
}
