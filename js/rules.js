/**
 * MetaWinners Flip — Flip 7–inspired rules (pure, deterministic with seed).
 *
 * Canonical composition (The Op / Asmodee-style):
 *   79 numbers (one 0 + n copies of n for 1..12), 7 modifiers (+2,+4,+6,+8,+8,+10,×2),
 *   3 Freeze, 3 Flip Three, 3 Second Chance (Joker faces) = 95 cards.
 * Scoring: sum numbers → ×2 if present → add +mods → +15 if Flip 7.
 * Bust on duplicate number (Joker/Second Chance discards the dupe once).
 * Round ends when no actives remain OR someone Flips 7. Match ends when any score ≥ 200 after banking.
 *
 * HOUSE (labeled): MetaWinners portrait identity / Joker art; does not change Flip 7 math.
 */
import { buildDeck, shuffle, mulberry32 } from './deck.js';

export const WIN_SCORE = 200;
export const FLIP7_BONUS = 15;

export function createPlayer(id, name, heroId, isHuman = true) {
  return {
    id,
    name,
    heroId,
    isHuman,
    score: 0,
    numbers: [],
    mods: [],
    lineCards: [], // physical cards currently in front of player
    secondChance: false,
    jokerHero: null,
    jokerCard: null,
    status: 'active', // active | stayed | busted | frozen
    lastRound: 0,
    lastReason: '',
    history: [],
  };
}

export function scoreLine(player) {
  if (player.status === 'busted') return 0;
  let sum = player.numbers.reduce((a, b) => a + b, 0);
  const hasX2 = player.mods.includes('x2');
  if (hasX2) sum *= 2;
  for (const m of player.mods) {
    if (typeof m === 'number') sum += m;
  }
  if (uniqueCount(player) >= 7) sum += FLIP7_BONUS;
  return sum;
}

export function uniqueCount(player) {
  return new Set(player.numbers).size;
}

export function hasFlip7(player) {
  return uniqueCount(player) >= 7;
}

export function bustRisk(player, remaining) {
  if (!remaining || !remaining.length) return 0;
  const have = new Set(player.numbers);
  let bad = 0;
  let nums = 0;
  for (const c of remaining) {
    if (c.kind === 'number') {
      nums++;
      if (have.has(c.value)) bad++;
    }
  }
  if (!nums) return 0;
  return bad / nums;
}

export function receiveNumber(player, value) {
  if (player.numbers.includes(value)) {
    if (player.secondChance) {
      const usedJoker = player.jokerCard;
      player.secondChance = false;
      player.jokerHero = null;
      player.jokerCard = null;
      return { busted: false, saved: true, flip7: false, discarded: value, usedJoker };
    }
    player.status = 'busted';
    return { busted: true, saved: false, flip7: false, discarded: value };
  }
  player.numbers.push(value);
  return { busted: false, saved: false, flip7: hasFlip7(player), discarded: null };
}

export function receiveMod(player, value) {
  player.mods.push(value);
}

export function receiveSecondChance(player, heroId = null, card = null) {
  if (player.secondChance) return { kept: false, needPass: true, hero: heroId };
  player.secondChance = true;
  player.jokerHero = heroId || player.jokerHero || 'gold_mage';
  player.jokerCard = card;
  return { kept: true, needPass: false, hero: player.jokerHero };
}

export function freezePlayer(player) {
  if (player.status !== 'active') return false;
  player.status = 'frozen';
  return true;
}

export function stayPlayer(player) {
  if (player.status !== 'active') return false;
  if (player.numbers.length === 0 && player.mods.length === 0 && !player.secondChance) {
    return false;
  }
  player.status = 'stayed';
  return true;
}

export function activePlayers(players) {
  return players.filter((p) => p.status === 'active');
}

export function createMatch({
  heroes = ['chaos', 'gold_mage', 'sheikh', 'poison'],
  names = null,
  humans = [true, false, false, false],
  seed = 1,
  winScore = WIN_SCORE,
} = {}) {
  const rng = mulberry32(seed);
  const players = heroes.map((h, i) =>
    createPlayer(i, (names && names[i]) || `P${i + 1}`, h, !!humans[i])
  );
  return {
    seed,
    winScore,
    players,
    dealer: 0,
    round: 0,
    phase: 'idle',
    deck: [],
    aside: [], // completed-round cards (reshuffle source)
    turn: 0,
    pendingAction: null,
    flip3Left: 0,
    flip3Target: null,
    flip3Queued: [],
    flip3Origin: null,
    log: [],
    lastEvent: null,
    rng,
    _dealIndex: null,
  };
}

/** Reshuffle only the aside pile (previous rounds). Never invent a fresh deck mid-match unless aside empty (emergency). */
function reshuffleIfNeeded(match) {
  if (match.deck.length > 0) return;
  if (match.aside.length > 0) {
    match.deck = shuffle(match.aside, match.rng);
    match.aside = [];
    match.lastEvent = { type: 'reshuffle', count: match.deck.length };
    match.log.push(match.lastEvent);
    return;
  }
  // Emergency only if aside exhausted (should be rare) — HOUSE: rebuild full deck
  match.deck = shuffle(buildDeck(), match.rng);
  match.lastEvent = { type: 'reshuffle_emergency', count: match.deck.length, house: true };
  match.log.push(match.lastEvent);
}

export function drawCard(match) {
  reshuffleIfNeeded(match);
  if (!match.deck.length) reshuffleIfNeeded(match);
  return match.deck.pop();
}

function clearLine(player) {
  player.numbers = [];
  player.mods = [];
  player.lineCards = [];
  player.secondChance = false;
  player.jokerHero = null;
  player.jokerCard = null;
  player.status = 'active';
  player.lastRound = 0;
  player.lastReason = '';
}

function collectLineToAside(match) {
  for (const p of match.players) {
    for (const c of p.lineCards) match.aside.push(c);
    if (p.jokerCard) match.aside.push(p.jokerCard);
    p.lineCards = [];
    p.jokerCard = null;
  }
}

export function startRound(match) {
  match.round += 1;
  for (const p of match.players) clearLine(p);
  if (match.round === 1 && match.deck.length === 0) {
    match.deck = shuffle(buildDeck(), match.rng);
    match.aside = [];
  }
  match.phase = 'dealing';
  match.turn = match.dealer;
  match.pendingAction = null;
  match.flip3Left = 0;
  match.flip3Target = null;
  match.flip3Queued = [];
  match.flip3Origin = null;
  match._dealIndex = 0;
  match.lastEvent = { type: 'round_start', round: match.round, dealer: match.dealer };
  match.log.push(match.lastEvent);
  return dealInitial(match);
}

export function dealInitial(match) {
  const n = match.players.length;
  if (match._dealIndex == null) match._dealIndex = 0;
  while (match._dealIndex < n) {
    const idx = (match.dealer + match._dealIndex) % n;
    match._dealIndex += 1;
    const card = drawCard(match);
    const result = applyCardToPlayer(match, idx, card, { fromDeal: true });
    if (result.needsTarget) {
      match.phase = 'action_pick';
      return result;
    }
    if (result.flip7 || result.roundEnd || result.matchEnd) return result;
  }
  match._dealIndex = null;
  match.phase = 'turn';
  match.turn = nextActiveFrom(match, match.dealer);
  match.lastEvent = { type: 'deal_done' };
  match.log.push(match.lastEvent);
  return { done: true };
}

export function nextActiveFrom(match, fromIdx) {
  const n = match.players.length;
  for (let i = 0; i < n; i++) {
    const idx = (fromIdx + i) % n;
    if (match.players[idx].status === 'active') return idx;
  }
  return -1;
}

export function nextActiveAfter(match, fromIdx) {
  const n = match.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    if (match.players[idx].status === 'active') return idx;
  }
  return -1;
}

function keepCard(player, card) {
  player.lineCards.push(card);
}

export function applyCardToPlayer(match, playerIdx, card) {
  const player = match.players[playerIdx];

  if (card.kind === 'number') {
    const r = receiveNumber(player, card.value);
    if (r.saved) {
      match.aside.push(card);
      if (r.usedJoker) match.aside.push(r.usedJoker);
      match.lastEvent = {
        type: 'second_save',
        player: playerIdx,
        value: card.value,
        reason: 'Joker discarded the duplicate',
      };
      match.log.push(match.lastEvent);
      return { ok: true, card, ...r };
    }
    if (r.busted) {
      match.aside.push(card);
      player.lastReason = `Bust on duplicate ${card.value}`;
      match.lastEvent = {
        type: 'bust',
        player: playerIdx,
        value: card.value,
        reason: player.lastReason,
      };
      match.log.push(match.lastEvent);
      return { ok: true, card, ...r };
    }
    keepCard(player, card);
    match.lastEvent = { type: 'number', player: playerIdx, value: card.value };
    match.log.push(match.lastEvent);
    if (r.flip7) {
      player.lastReason = 'Flip 7!';
      return endRound(match, { reason: 'flip7', winner: playerIdx });
    }
    return { ok: true, card, ...r };
  }

  if (card.kind === 'mod') {
    receiveMod(player, card.value);
    keepCard(player, card);
    match.lastEvent = { type: 'mod', player: playerIdx, value: card.value };
    match.log.push(match.lastEvent);
    return { ok: true, card };
  }

  // Actions
  const actives = activePlayers(match.players).map((p) => p.id);
  match.pendingAction = { card, from: playerIdx, kind: card.value };
  match.lastEvent = {
    type: 'action_drawn',
    player: playerIdx,
    value: card.value,
    reason: card.value === 'second' ? 'Joker drawn' : `${card.value} drawn`,
  };
  match.log.push(match.lastEvent);

  if (card.value === 'second') {
    const r = receiveSecondChance(player, card.hero || 'gold_mage', card);
    if (r.kept) {
      match.pendingAction = null;
      return { ok: true, card, secondKept: true, joker: true };
    }
    const targets = actives.filter((id) => id !== playerIdx && !match.players[id].secondChance);
    if (targets.length === 0) {
      match.pendingAction = null;
      match.aside.push(card);
      return { ok: true, card, secondDiscarded: true };
    }
    if (targets.length === 1) return resolveAction(match, targets[0]);
    match.phase = 'action_pick';
    return { needsTarget: true, card, targets, reason: 'second_pass' };
  }

  // freeze / flip3 — only active targets
  if (actives.length === 0) {
    match.pendingAction = null;
    match.aside.push(card);
    return { ok: true, card, noTarget: true };
  }
  if (actives.length === 1) return resolveAction(match, actives[0]);
  match.phase = 'action_pick';
  return { needsTarget: true, card, targets: actives };
}

export function resolveAction(match, targetIdx) {
  const pending = match.pendingAction;
  if (!pending) return { error: 'no_pending' };
  const card = pending.card;
  const target = match.players[targetIdx];
  if (!target || (card.value !== 'second' && target.status !== 'active')) {
    return { error: 'bad_target' };
  }
  match.pendingAction = null;

  if (card.value === 'second') {
    receiveSecondChance(target, card.hero || 'gold_mage', card);
    match.lastEvent = {
      type: 'second_pass',
      from: pending.from,
      to: targetIdx,
      joker: true,
      hero: card.hero,
      reason: `Joker passed to ${target.name}`,
    };
    match.log.push(match.lastEvent);
    return continueAfterAction(match, { ok: true, card, target: targetIdx });
  }

  if (card.value === 'freeze') {
    freezePlayer(target);
    match.aside.push(card);
    target.lastReason = 'Frozen — line banked';
    match.lastEvent = {
      type: 'freeze',
      from: pending.from,
      to: targetIdx,
      reason: `${target.name} frozen`,
    };
    match.log.push(match.lastEvent);
    if (activePlayers(match.players).length === 0) {
      return endRound(match, { reason: 'no_active' });
    }
    return continueAfterAction(match, { ok: true, card, target: targetIdx, frozen: true });
  }

  if (card.value === 'flip3') {
    match.aside.push(card);
    match.phase = 'flip3';
    match.flip3Left = 3;
    match.flip3Target = targetIdx;
    match.flip3Origin = pending.from;
    match.flip3Queued = [];
    match.lastEvent = {
      type: 'flip3_start',
      from: pending.from,
      to: targetIdx,
      left: 3,
      reason: `${target.name} must flip 3`,
    };
    match.log.push(match.lastEvent);
    // One card at a time — caller continues via stepFlip3
    return stepFlip3(match, { one: true });
  }

  return { error: 'unknown_action' };
}

/**
 * Flip Three: flip one card per call (default). Pass { all: true } to drain remaining for tests/bots.
 */
export function stepFlip3(match, opts = { one: true }) {
  const drain = opts.all === true;
  let last = { flip3Step: true };

  while (match.flip3Left > 0) {
    const t = match.flip3Target;
    const player = match.players[t];
    if (!player || player.status !== 'active') {
      match.flip3Left = 0;
      match.flip3Queued = [];
      break;
    }
    const card = drawCard(match);
    match.flip3Left -= 1;

    if (card.kind === 'number') {
      const r = receiveNumber(player, card.value);
      if (r.saved) {
        match.aside.push(card);
        if (r.usedJoker) match.aside.push(r.usedJoker);
        match.lastEvent = {
          type: 'second_save', player: t, value: card.value, via: 'flip3', left: match.flip3Left,
          reason: 'Joker saved a Flip Three duplicate',
        };
        match.log.push(match.lastEvent);
        last = { ...r, card, flip3Step: true, left: match.flip3Left };
      } else if (r.busted) {
        match.aside.push(card);
        player.lastReason = `Bust on Flip Three (${card.value})`;
        match.lastEvent = {
          type: 'bust', player: t, value: card.value, via: 'flip3', left: 0,
          reason: player.lastReason,
        };
        match.log.push(match.lastEvent);
        match.flip3Left = 0;
        match.flip3Queued = [];
        last = { ...r, card, flip3Step: true, busted: true };
        break;
      } else {
        keepCard(player, card);
        match.lastEvent = {
          type: 'number', player: t, value: card.value, via: 'flip3', left: match.flip3Left,
        };
        match.log.push(match.lastEvent);
        if (r.flip7) {
          match.flip3Left = 0;
          match.flip3Queued = [];
          return endRound(match, { reason: 'flip7', winner: t });
        }
        last = { ...r, card, flip3Step: true, left: match.flip3Left };
      }
    } else if (card.kind === 'mod') {
      receiveMod(player, card.value);
      keepCard(player, card);
      match.lastEvent = { type: 'mod', player: t, value: card.value, via: 'flip3', left: match.flip3Left };
      match.log.push(match.lastEvent);
      last = { ok: true, card, flip3Step: true, left: match.flip3Left };
    } else if (card.value === 'second') {
      const r = receiveSecondChance(player, card.hero || 'gold_mage', card);
      if (!r.kept) {
        const others = activePlayers(match.players)
          .map((p) => p.id)
          .filter((id) => id !== t && !match.players[id].secondChance);
        if (others.length === 1) {
          receiveSecondChance(match.players[others[0]], card.hero || 'gold_mage', card);
        } else if (others.length > 1) {
          match.pendingAction = { card, from: t, kind: 'second' };
          match.phase = 'action_pick';
          match.lastEvent = { type: 'second', player: t, via: 'flip3', needsPass: true };
          match.log.push(match.lastEvent);
          return { needsTarget: true, card, targets: others, reason: 'second_pass', duringFlip3: true };
        } else {
          match.aside.push(card);
        }
      }
      match.lastEvent = { type: 'second', player: t, via: 'flip3', left: match.flip3Left };
      match.log.push(match.lastEvent);
      last = { ok: true, card, flip3Step: true, left: match.flip3Left };
    } else {
      match.flip3Queued.push(card);
      match.lastEvent = { type: 'flip3_queue', player: t, value: card.value, left: match.flip3Left };
      match.log.push(match.lastEvent);
      last = { ok: true, card, flip3Step: true, queued: true, left: match.flip3Left };
    }

    if (!drain && match.flip3Left > 0) {
      match.phase = 'flip3';
      return { ...last, flip3Continue: true, left: match.flip3Left, target: t };
    }
  }

  while (match.flip3Left === 0 && match.flip3Queued.length) {
    const next = match.flip3Queued.shift();
    const t = match.flip3Target;
    if (!match.players[t] || match.players[t].status === 'busted') {
      match.aside.push(next);
      continue;
    }
    match.pendingAction = { card: next, from: t, kind: next.value };
    const actives = activePlayers(match.players).map((p) => p.id);
    if (actives.length === 0) {
      match.aside.push(next);
      match.pendingAction = null;
      continue;
    }
    if (actives.length === 1) return resolveAction(match, actives[0]);
    match.phase = 'action_pick';
    return { needsTarget: true, card: next, targets: actives, afterFlip3: true };
  }

  match.flip3Target = null;
  match.flip3Origin = null;
  return continueAfterAction(match, { flip3Done: true, ...last });
}

function continueAfterAction(match, payload) {
  // Resume Flip Three after a mid-sequence target pick (e.g. duplicate Joker pass)
  if (match.flip3Left > 0 && match.flip3Target != null) {
    match.phase = 'flip3';
    return stepFlip3(match, { one: true });
  }
  if (match._dealIndex != null) {
    match.phase = 'dealing';
    return dealInitial(match);
  }
  if (activePlayers(match.players).length === 0) {
    return endRound(match, { reason: 'no_active' });
  }
  match.phase = 'turn';
  if (match.players[match.turn]?.status !== 'active') {
    match.turn = nextActiveAfter(match, match.turn);
  }
  if (match.turn < 0) return endRound(match, { reason: 'no_active' });
  return payload;
}

export function playerHit(match) {
  if (match.phase !== 'turn') return { error: 'not_turn_phase' };
  const p = match.players[match.turn];
  if (!p || p.status !== 'active') return { error: 'not_active' };
  const card = drawCard(match);
  const result = applyCardToPlayer(match, match.turn, card);
  if (result.needsTarget || result.roundEnd || result.matchEnd) return result;
  if (result.busted) {
    if (activePlayers(match.players).length === 0) return endRound(match, { reason: 'no_active' });
    match.turn = nextActiveAfter(match, match.turn);
    if (match.turn < 0) return endRound(match, { reason: 'no_active' });
    return result;
  }
  match.turn = nextActiveAfter(match, match.turn);
  if (match.turn < 0) return endRound(match, { reason: 'no_active' });
  return result;
}

export function playerStay(match) {
  if (match.phase !== 'turn') return { error: 'not_turn_phase' };
  const p = match.players[match.turn];
  if (!p || p.status !== 'active') return { error: 'not_active' };
  if (!stayPlayer(p)) return { error: 'must_hit' };
  p.lastReason = 'Stayed — line banked';
  match.lastEvent = { type: 'stay', player: match.turn, reason: p.lastReason };
  match.log.push(match.lastEvent);
  if (activePlayers(match.players).length === 0) return endRound(match, { reason: 'no_active' });
  match.turn = nextActiveAfter(match, match.turn);
  if (match.turn < 0) return endRound(match, { reason: 'no_active' });
  return { stayed: true };
}

export function endRound(match, info = {}) {
  for (const p of match.players) {
    const pts = scoreLine(p);
    p.lastRound = pts;
    p.score += pts;
    p.history.push(pts);
    if (p.status === 'busted') p.lastReason = p.lastReason || 'Bust — scored 0';
    else if (info.reason === 'flip7' && info.winner === p.id) p.lastReason = 'Flip 7 (+15)';
    else if (!p.lastReason) p.lastReason = pts ? `Banked ${pts}` : 'No points';
  }
  collectLineToAside(match);
  for (const p of match.players) {
    p.secondChance = false;
    p.jokerHero = null;
  }
  match.phase = 'round_end';
  match._dealIndex = null;
  match.flip3Left = 0;
  match.pendingAction = null;
  match.flip3Queued = [];
  match.lastEvent = {
    type: 'round_end',
    ...info,
    scores: match.players.map((p) => p.score),
    reasons: match.players.map((p) => p.lastReason),
  };
  match.log.push(match.lastEvent);

  const max = Math.max(...match.players.map((p) => p.score));
  if (max >= match.winScore) {
    match.phase = 'match_end';
    const winners = match.players.filter((p) => p.score === max).map((p) => p.id);
    match.lastEvent = {
      type: 'match_end',
      winners,
      scores: match.players.map((p) => p.score),
      reason: `First to ${match.winScore}`,
    };
    match.log.push(match.lastEvent);
    return { matchEnd: true, winners, ...info };
  }
  match.dealer = (match.dealer + 1) % match.players.length;
  return { roundEnd: true, ...info };
}

export function advanceToNextRound(match) {
  if (match.phase !== 'round_end') return { error: 'not_round_end' };
  return startRound(match);
}

/** Cards still in play this round (not drawable). */
export function cardsInPlayCount(match) {
  let n = match.deck.length + match.aside.length;
  for (const p of match.players) {
    n += p.lineCards.length;
    if (p.jokerCard) n += 1;
  }
  if (match.pendingAction?.card) n += 1;
  for (const c of match.flip3Queued) n += 1;
  return n;
}
