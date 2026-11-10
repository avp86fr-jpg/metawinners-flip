/** Rational bots: risk from remaining deck + match score pressure + light style variance. */
import { bustRisk, scoreLine, activePlayers } from './rules.js';

function styleBias(heroId = '') {
  const aggressive = new Set(['bloodbath', 'chaos', 'fire', 'poison', 'gladiator']);
  const careful = new Set(['sheikh', 'gold_mage', 'ice', 'optimus', 'chief']);
  if (aggressive.has(heroId)) return -0.04; // tolerate more risk
  if (careful.has(heroId)) return 0.05;
  return 0;
}

export function botDecide(match, playerIdx) {
  const p = match.players[playerIdx];
  const risk = bustRisk(p, match.deck) + styleBias(p.heroId);
  const line = scoreLine({ ...p, status: 'active' });
  const n = p.numbers.length;
  const winAt = match.winScore || 200;
  const myTotal = p.score + line;
  const others = match.players.filter((_, i) => i !== playerIdx);
  const bestOtherScore = Math.max(0, ...others.map((o) => o.score));
  const bestOtherLine = Math.max(
    0,
    ...others.map((o) => (o.status === 'busted' ? 0 : scoreLine({ ...o, status: o.status === 'active' ? 'stayed' : o.status }))),
  );
  const lead = myTotal - (bestOtherScore + (others.find((o) => o.status === 'active') ? 0 : bestOtherLine));

  if (n === 0 && p.mods.length === 0 && !p.secondChance) return 'hit';

  // Can clinch match by banking now
  if (myTotal >= winAt && n >= 1) return 'stay';

  // Behind late — push more
  const behind = bestOtherScore - p.score;
  if (behind > 40 && risk < 0.42) return 'hit';
  if (behind > 70 && risk < 0.5 && p.secondChance) return 'hit';

  // Flip 7 chase
  if (n >= 6 && (risk < 0.4 || p.secondChance)) return 'hit';
  if (n >= 5 && risk < 0.32) return 'hit';

  // Safe bank
  if (line >= 50 && risk > 0.18) return 'stay';
  if (line >= 35 && risk > 0.28) return 'stay';
  if (n >= 4 && risk > 0.3 && !p.secondChance) return 'stay';
  if (risk > 0.38 && !p.secondChance) return 'stay';
  if (risk > 0.52) return 'stay';

  // Ahead on locked value — take the safe exit
  if (lead > 15 && risk > 0.18 && n >= 3) return 'stay';
  if (bestOtherLine > 0 && line >= bestOtherLine + 10 && risk > 0.22 && n >= 3) return 'stay';

  return 'hit';
}

export function botPickTarget(match, targets, card) {
  const kind = card.value;
  const me = match.pendingAction?.from ?? match.turn;
  // Never target inactive seats for freeze/flip3
  if (kind === 'freeze' || kind === 'flip3') {
    targets = targets.filter((t) => match.players[t]?.status === 'active');
    if (!targets.length) return me;
  }
  if (kind === 'freeze') {
    let best = targets[0];
    let bestScore = -1e9;
    for (const t of targets) {
      const p = match.players[t];
      let s = scoreLine({ ...p, status: 'stayed' }) + p.score * 0.08;
      if (t === me) {
        const risk = bustRisk(p, match.deck);
        if (targets.length > 1 && !(p.numbers.length >= 5 && risk > 0.35)) continue;
        s -= 20;
      }
      if (s > bestScore) { bestScore = s; best = t; }
    }
    return best;
  }
  if (kind === 'flip3') {
    const meP = match.players[me];
    if (targets.includes(me) && meP.numbers.length <= 2 && bustRisk(meP, match.deck) < 0.25) return me;
    let best = targets[0];
    let bestScore = -1e9;
    for (const t of targets) {
      if (t === me && targets.length > 1) continue;
      const p = match.players[t];
      const s = scoreLine({ ...p, status: 'stayed' }) + p.score * 0.05;
      if (s > bestScore) { bestScore = s; best = t; }
    }
    return best;
  }
  const others = targets.filter((t) => t !== me);
  // Pass joker to lowest-risk active friend
  let best = others[0] ?? targets[0];
  let bestR = 99;
  for (const t of others) {
    const r = bustRisk(match.players[t], match.deck);
    if (r < bestR) { bestR = r; best = t; }
  }
  return best;
}
