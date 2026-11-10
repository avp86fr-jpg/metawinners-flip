/**
 * MetaWinners card identity — portraits + frames for numbers & Jokers.
 * Joker face === Second Chance rule (same mechanic).
 * All 25 confirmed 1/1s cycle onto Jokers + appear in gallery.
 */
import { ONES, BY_ID } from './roster.js';

/** Number value → associated MetaWinners 1/1 (collection identity on the face). */
export const NUMBER_HERO = {
  0: 'cowboy',
  1: 'chaos',
  2: 'poison',
  3: 'sheikh',
  4: 'gold_mage',
  5: 'hockey_mask',
  6: 'chief',
  7: 'bloodbath',
  8: 'ice',
  9: 'fire',
  10: 'hunter',
  11: 'gladiator',
  12: 'medusa',
};

/** Full Joker pool = every confirmed 1/1. */
export const JOKER_HEROES = ONES.map((r) => r.id);

export function heroForNumber(value) {
  return NUMBER_HERO[value] || 'chaos';
}

export function heroInfo(id) {
  return BY_ID[id] || BY_ID.chaos;
}

export function isJokerCard(card) {
  return !!card && card.kind === 'action' && card.value === 'second';
}

/** Stamp collection identity. Each shuffle cycles 3 distinct Jokers from all 25. */
export function stampDeckIdentity(cards, rng = Math.random) {
  const pool = JOKER_HEROES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let jokerIdx = 0;
  for (const c of cards) {
    if (c.kind === 'number') {
      c.hero = heroForNumber(c.value);
    } else if (c.kind === 'action' && c.value === 'second') {
      c.face = 'joker';
      c.hero = pool[jokerIdx % pool.length];
      jokerIdx += 1;
    } else if (c.kind === 'action') {
      c.hero = c.value === 'freeze' ? 'hockey_mask' : 'bloodbath';
    } else if (c.kind === 'mod') {
      c.hero = c.value === 'x2' ? 'gold_mage' : 'chief';
    }
  }
  return cards;
}
