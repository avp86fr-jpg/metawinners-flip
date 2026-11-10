import { ROSTER, BY_ID, unlockedIds, ONES, ONES_SOURCE } from './roster.js';
import {
  createMatch, startRound, playerHit, playerStay, resolveAction,
  advanceToNextRound, scoreLine, activePlayers, WIN_SCORE, FLIP7_BONUS, stepFlip3,
} from './rules.js';
import { botDecide, botPickTarget } from './ai.js';
import { SFX, setMuted, loadMute, isMuted, bindAudioGestures, unlockAudioFromGesture, syncMuteButton, toggleMuteFromUi, applyMusicState } from './audio.js';
import { heroForNumber, heroInfo, isJokerCard, JOKER_HEROES } from './cards.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = {
  screen: 'title',
  mode: 'bots', // bots | pass
  hero: 'chaos',
  wins: 0,
  match: null,
  busy: false,
  toast: '',
  toastKind: '',
};

function loadProgress() {
  try {
    const w = parseInt(localStorage.getItem('mwflip_wins') || '0', 10);
    state.wins = Number.isFinite(w) ? w : 0;
    const h = localStorage.getItem('mwflip_hero');
    if (h && BY_ID[h]) state.hero = h;
  } catch {}
  loadMute();
}
function saveProgress() {
  try {
    localStorage.setItem('mwflip_wins', String(state.wins));
    localStorage.setItem('mwflip_hero', state.hero);
  } catch {}
}

function showScreen(id) {
  state.screen = id;
  $$('.screen').forEach((el) => el.classList.toggle('on', el.id === `screen-${id}`));
}

function cardEl(card, { small = false, animate = true, pop = false, heroId = null } = {}) {
  const d = document.createElement('div');
  const joker = isJokerCard(card) || card.face === 'joker';
  d.className = `card ${card.kind === 'number' ? 'num' : card.kind} ${small ? 'sm' : ''} ${pop ? 'flip-pop' : ''} ${joker ? 'joker' : ''}`;
  if (!animate) d.style.animation = 'none';

  if (card.kind === 'number') {
    const hid = heroId || card.hero || heroForNumber(card.value);
    const h = heroInfo(hid);
    d.classList.add(`v${card.value}`);
    d.style.setProperty('--accent', h.accent);
    // Trading-card: full-height portrait strip | clean numeral panel
    d.innerHTML = `
      <div class="tc">
        <div class="tc-art" style="background-image:url('${h.portrait}')"></div>
        <div class="tc-panel">
          <span class="pip tl">${card.value}</span>
          <span class="pip br">${card.value}</span>
          <span class="big">${card.value}</span>
        </div>
      </div>`;
  } else if (card.kind === 'mod') {
    const hid = card.hero || (card.value === 'x2' ? 'gold_mage' : 'chief');
    const h = heroInfo(hid);
    d.style.setProperty('--accent', h.accent);
    const label = card.value === 'x2' ? '×2' : `+${card.value}`;
    d.innerHTML = `
      <div class="tc mod">
        <div class="tc-art dim" style="background-image:url('${h.portrait}')"></div>
        <div class="tc-panel">
          <span class="big modbig">${label}</span>
          <span class="tc-name">MOD</span>
        </div>
      </div>`;
  } else if (joker) {
    const hid = heroId || card.hero || 'gold_mage';
    const h = heroInfo(hid);
    d.style.setProperty('--accent', h.accent);
    d.innerHTML = `
      <div class="joker-shell">
        <div class="joker-art" style="background-image:url('${h.portrait}')"></div>
        <div class="joker-foil"></div>
        <div class="mw-frame joker-frame"></div>
        <div class="joker-mark">JOKER</div>
        <div class="joker-sub">2nd CHANCE</div>
        <span class="mw-tag ones">1/1 · ${h.name}</span>
      </div>`;
  } else {
    const map = {
      freeze: { ico: '❄', t: 'FREEZE', hero: 'hockey_mask' },
      flip3: { ico: 'ⅲ', t: 'FLIP 3', hero: 'bloodbath' },
    };
    const m = map[card.value] || { ico: '?', t: '?', hero: 'chaos' };
    const h = heroInfo(card.hero || m.hero);
    d.classList.add(card.value);
    d.style.setProperty('--accent', h.accent);
    d.innerHTML = `
      <div class="tc action">
        <div class="tc-art dim" style="background-image:url('${h.portrait}')"></div>
        <div class="tc-panel act">
          <span class="act-ico">${m.ico}</span>
          <span class="act-lab">${m.t}</span>
        </div>
      </div>`;
  }
  return d;
}

function lineCards(player, small, { popLast = false } = {}) {
  const frag = document.createDocumentFragment();
  const nums = player.numbers;
  nums.forEach((v, i) => {
    frag.appendChild(cardEl({ kind: 'number', value: v }, {
      small, animate: true, pop: popLast && i === nums.length - 1 && !player.mods.length && !player.secondChance,
    }));
  });
  player.mods.forEach((m, i) => {
    const last = i === player.mods.length - 1 && !player.secondChance;
    frag.appendChild(cardEl({ kind: 'mod', value: m }, { small, pop: popLast && last }));
  });
  if (player.secondChance) {
    frag.appendChild(cardEl(
      { kind: 'action', value: 'second', face: 'joker', hero: player.jokerHero || 'gold_mage' },
      { small, pop: popLast, heroId: player.jokerHero || 'gold_mage' },
    ));
  }
  return frag;
}

function spawnDealGhost(toEl) {
  const deck = $('#deckpile');
  if (!deck || !toEl) return;
  const a = deck.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const g = document.createElement('div');
  g.className = 'deal-ghost';
  g.style.left = `${a.left}px`;
  g.style.top = `${a.top}px`;
  document.body.appendChild(g);
  requestAnimationFrame(() => {
    const dx = b.left + b.width / 2 - a.width / 2 - a.left;
    const dy = b.top + b.height / 2 - a.height / 2 - a.top;
    g.style.transform = `translate(${dx}px, ${dy}px) rotate(12deg) scale(.85)`;
    g.classList.add('gone');
  });
  setTimeout(() => g.remove(), 360);
}

function statusLabel(p) {
  if (p.status === 'busted') return 'BUST';
  if (p.status === 'stayed' || p.status === 'frozen') return 'BANKED';
  return 'LIVE';
}

function renderPlay() {
  const m = state.match;
  if (!m) return;
  const youIdx = m.players.findIndex((p) => p.isHuman) >= 0
    ? m.players.findIndex((p) => p.isHuman && (state.mode === 'bots' || p.id === m.turn || true))
    : 0;
  // In pass mode, "you" is current human whose turn it is, else first human
  let focus = 0;
  if (state.mode === 'pass') {
    const t = m.players[m.turn];
    focus = (t && t.isHuman) ? m.turn : m.players.findIndex((p) => p.isHuman);
    if (focus < 0) focus = 0;
  } else {
    focus = m.players.findIndex((p) => p.isHuman);
    if (focus < 0) focus = 0;
  }

  const opp = $('#opponents');
  opp.innerHTML = '';
  m.players.forEach((p, i) => {
    if (state.mode === 'bots' && i === focus) return;
    if (state.mode === 'pass' && i === focus && m.phase === 'turn') {
      // still show others only
    }
    if (i === focus) return;
    const hero = BY_ID[p.heroId];
    const seat = document.createElement('div');
    seat.className = `seat ${p.status === 'busted' ? 'bust' : ''} ${p.status === 'stayed' || p.status === 'frozen' ? 'stayed' : ''} ${m.turn === i && m.phase === 'turn' ? 'turn' : ''}`;
    seat.innerHTML = `
      <div class="seat-head">
        <img src="${hero.portrait}" alt="">
        <div class="who">${p.name}<small>${statusLabel(p)} · LINE ${p.status === 'busted' ? 0 : scoreLine({ ...p, status: p.status === 'busted' ? 'busted' : 'stayed' })}</small></div>
        <div class="scorechip" title="Banked score">${p.score}<span class="chip-lab">BANK</span></div>
      </div>
      <div class="cards"></div>`;
    if (p.status === 'active' && p.numbers.length >= 5) seat.classList.add('danger-pulse');
    const cardsEl = seat.querySelector('.cards');
    if (state.mode === 'pass' && p.status === 'active' && i !== focus) {
      const nHide = p.numbers.length + p.mods.length + (p.secondChance ? 1 : 0);
      for (let k = 0; k < nHide; k++) {
        const back = document.createElement('div');
        back.className = 'card sm card-back privacy-back';
        cardsEl.appendChild(back);
      }
    } else {
      cardsEl.appendChild(lineCards(p, true));
    }
    opp.appendChild(seat);
  });

  const you = m.players[focus];
  const yHero = BY_ID[you.heroId];
  const yz = $('#you-zone');
  yz.className = `you-zone ${m.turn === focus && m.phase === 'turn' ? 'turn' : ''}`;
  if (you.status === 'busted') yz.classList.add('bust-flash');
  $('#you-portrait').src = yHero.portrait;
  $('#you-name').textContent = state.mode === 'pass' ? `${you.name}'s turn` : you.name;
  $('#you-sub').textContent = `${statusLabel(you)} · goal ${m.winScore}`;
  const linePts = you.status === 'busted' ? 0 : scoreLine({ ...you, status: 'stayed' });
  $('#line-score').textContent = linePts;
  const bankEl = $('#bank-score');
  if (bankEl) bankEl.textContent = you.score;
  const badges = $('#badges');
  badges.innerHTML = '';
  if (you.secondChance) badges.innerHTML += `<span class="badge">JOKER · 2nd CHANCE</span>`;
  if (you.numbers.length >= 5) badges.innerHTML += `<span class="badge hot">${you.numbers.length}/7 TO FLIP</span>`;
  if (you.mods.includes('x2')) badges.innerHTML += `<span class="badge">×2</span>`;

  const yc = $('#you-cards');
  yc.innerHTML = '';
  yc.appendChild(lineCards(you, false, { popLast: !!state.popLine }));
  // near-bust tension: 5+ unique numbers while live
  yz.classList.toggle('danger-pulse', you.status === 'active' && you.numbers.length >= 5);

  $('#deckpile').dataset.n = String(m.deck.length);
  const dc = $('#deck-count');
  if (dc) dc.textContent = String(m.deck.length);
  $('#round-pill').textContent = `Round ${m.round}`;
  $('#target-pill').textContent = `First to ${m.winScore}`;

  const toast = $('#toast');
  toast.textContent = state.toast || defaultToast(m, focus);
  toast.className = `toast ${state.toastKind || ''}`;

  const turnP = m.players[m.turn];
  const canAct = m.phase === 'turn' && turnP?.isHuman && turnP.status === 'active' && !state.busy;
  const mustHit = canAct && turnP.numbers.length === 0 && turnP.mods.length === 0 && !turnP.secondChance;
  $('#btn-hit').disabled = !canAct;
  $('#btn-stay').disabled = !canAct || mustHit;

  // Action overlay
  const ov = $('#overlay-action');
  if (m.phase === 'action_pick' && m.pendingAction && m.players[m.pendingAction.from]?.isHuman) {
    ov.classList.add('on');
    const card = m.pendingAction.card;
    $('#action-title').textContent = cardLabel(card);
    $('#action-desc').textContent = cardDesc(card);
    const grid = $('#target-grid');
    grid.innerHTML = '';
    const actives = activePlayers(m.players).map((p) => p.id);
    let targets = actives;
    if (card.value === 'second') {
      targets = actives.filter((id) => id !== m.pendingAction.from && !m.players[id].secondChance);
    }
    targets.forEach((tid) => {
      const p = m.players[tid];
      const h = BY_ID[p.heroId];
      const b = document.createElement('button');
      b.innerHTML = `<img src="${h.portrait}" alt=""><div><strong>${p.name}</strong><div style="font-size:11px;color:#9aa8bf">line ${scoreLine({ ...p, status: 'stayed' })}</div></div>`;
      b.onclick = () => onPickTarget(tid);
      grid.appendChild(b);
    });
  } else {
    ov.classList.remove('on');
  }
  // one-shot pop
  state.popLine = false;
}

function cardLabel(card) {
  if (card.value === 'freeze') return '❄ Freeze';
  if (card.value === 'flip3') return 'ⅲ Flip Three';
  if (card.value === 'second') return '🃏 Joker · Second Chance';
  return 'Action';
}
function cardDesc(card) {
  if (card.value === 'freeze') return 'Pick who banks their line right now.';
  if (card.value === 'flip3') return 'Pick who must flip the next 3 cards.';
  if (card.value === 'second') return 'Joker = Second Chance. Pass the extra Joker to another live player.';
  return '';
}
function defaultToast(m, focus) {
  if (m.phase === 'dealing') return 'Dealing…';
  if (m.phase === 'flip3') return 'Flip Three in progress…';
  if (m.phase === 'action_pick') return 'Choose a target';
  if (m.phase === 'turn') {
    const p = m.players[m.turn];
    if (!p) return '';
    if (p.isHuman) return state.mode === 'pass' ? `${p.name}: Hit or Stay?` : 'Your call — Hit or Stay';
    return `${p.name} is thinking…`;
  }
  return '';
}

function pulseScore() {
  const el = $('#line-score');
  if (!el) return;
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');
}

function reactToEvent(ev) {
  if (!ev) return;
  state.popLine = false;
  if (ev.type === 'number') {
    SFX.flip();
    state.toast = ev.via === 'flip3' ? `Flip Three → +${ev.value} (${ev.left ?? 0} left)` : `+${ev.value}`;
    state.toastKind = '';
    state.popLine = true;
    requestAnimationFrame(() => spawnDealGhost($('#you-cards')));
  }
  if (ev.type === 'bust') {
    SFX.bust();
    state.toast = ev.reason || 'BUST!';
    state.toastKind = 'warn';
    state.popLine = true;
  }
  if (ev.type === 'second_save') {
    SFX.save();
    state.toast = ev.reason || 'Joker saved you!';
    state.toastKind = 'good';
    state.popLine = true;
  }
  if (ev.type === 'mod') {
    SFX.flip();
    state.toast = ev.value === 'x2' ? '×2 modifier!' : `+${ev.value} modifier`;
    state.toastKind = 'gold';
    state.popLine = true;
    requestAnimationFrame(() => spawnDealGhost($('#you-cards')));
  }
  if (ev.type === 'freeze') { SFX.stay(); state.toast = ev.reason || 'Frozen — banked'; state.toastKind = ''; pulseScore(); }
  if (ev.type === 'stay') { SFX.stay(); state.toast = ev.reason || 'Stayed — banked'; state.toastKind = 'good'; pulseScore(); }
  if (ev.type === 'flip3_start') { SFX.click(); state.toast = ev.reason || 'Flip Three!'; state.toastKind = 'gold'; }
  if (ev.type === 'round_end' && ev.reason === 'flip7') {
    state.toast = 'Flip 7! +15 — round over';
    state.toastKind = 'gold';
  }
  if (ev.type === 'reshuffle') { state.toast = 'Deck reshuffled from aside'; state.toastKind = ''; }
}

async function afterMove(result) {
  const m = state.match;
  reactToEvent(m.lastEvent);
  if (result?.flip7 || result?.reason === 'flip7' || (result?.roundEnd && result.reason === 'flip7') || (result?.matchEnd && result.reason === 'flip7')) {
    SFX.flip7();
    await showFlip7(result.winner ?? m.lastEvent?.winner ?? m.lastEvent?.player);
  }
  if (result?.flip3Continue && m.phase === 'flip3') {
    renderPlay();
    state.busy = true;
    await wait(140);
    const next = stepFlip3(m, { one: true });
    state.busy = false;
    await afterMove(next);
    return;
  }
  if (result?.roundEnd || result?.matchEnd || m.phase === 'round_end' || m.phase === 'match_end') {
    await showRoundEnd();
    return;
  }
  renderPlay();
  await maybeBotTurn();
}

async function showFlip7(winnerIdx) {
  const ov = $('#overlay-flip7');
  const p = state.match.players[winnerIdx] || state.match.players[0];
  $('#flip7-name').textContent = `${p.name} hit FLIP 7!`;
  ov.classList.add('on');
  await wait(900);
  ov.classList.remove('on');
}

function showRoundEnd() {
  return new Promise((resolve) => {
    const m = state.match;
    const ov = $('#overlay-round');
    const matchOver = m.phase === 'match_end';
    $('#round-title').textContent = matchOver ? 'Match Over' : `Round ${m.round} complete`;
    const tb = $('#score-body');
    tb.innerHTML = '';
    const max = Math.max(...m.players.map((p) => p.score));
    m.players
      .slice()
      .sort((a, b) => b.score - a.score)
      .forEach((p) => {
        const tr = document.createElement('tr');
        const win = matchOver && p.score === max;
        const hero = BY_ID[p.heroId];
        tr.innerHTML = `<td class="${win ? 'win' : ''}"></td><td>${p.lastRound}</td><td class="${win ? 'win' : ''}">${p.score}</td>`;
        tr.children[0].innerHTML = `<div style="display:flex;align-items:center;gap:8px"><img src="${hero.portrait}" width="28" height="28" style="border-radius:8px;object-fit:cover"> <div><div>${p.name}${win ? ' ★' : ''}</div><small style="color:#9aa8bf">${p.lastReason || ''}</small></div></div>`;
        tb.appendChild(tr);
      });
    const btn = $('#btn-next-round');
    btn.textContent = matchOver ? 'Play again' : 'Next round';
    btn.onclick = async () => {
      ov.classList.remove('on');
      SFX.click();
      if (matchOver) {
        const humanWon = m.players.some((p) => p.isHuman && p.score === max);
        if (humanWon) {
          state.wins += 1;
          saveProgress();
          SFX.win();
        }
        showScreen('setup');
        renderSetup();
        resolve();
        return;
      }
      state.busy = true;
      advanceToNextRound(m);
      state.busy = false;
      renderPlay();
      await maybeBotTurn();
      resolve();
    };
    ov.classList.add('on');
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function maybeBotTurn() {
  const m = state.match;
  if (!m || state.busy) return;
  // Keep resolving bot actions / turns
  let guard = 0;
  while (guard++ < 80) {
    if (m.phase === 'round_end' || m.phase === 'match_end') return;
    if (m.phase === 'action_pick' && m.pendingAction) {
      const from = m.players[m.pendingAction.from];
      if (from.isHuman) { renderPlay(); return; }
      state.busy = true;
      await wait(90);
      const actives = activePlayers(m.players).map((p) => p.id);
      let targets = actives;
      if (m.pendingAction.card.value === 'second') {
        targets = actives.filter((id) => id !== m.pendingAction.from && !m.players[id].secondChance);
      }
      const t = botPickTarget(m, targets, m.pendingAction.card);
      const result = resolveAction(m, t);
      state.busy = false;
      reactToEvent(m.lastEvent);
      if (result?.roundEnd || result?.matchEnd || m.phase === 'round_end' || m.phase === 'match_end') {
        renderPlay();
        await afterMove(result);
        return;
      }
      renderPlay();
      continue;
    }
    if (m.phase === 'flip3') {
      state.busy = true;
      await wait(90);
      const fr = stepFlip3(m, { one: true });
      state.busy = false;
      reactToEvent(m.lastEvent);
      if (fr?.roundEnd || fr?.matchEnd || m.phase === 'round_end' || m.phase === 'match_end') {
        renderPlay();
        await afterMove(fr);
        return;
      }
      if (fr?.needsTarget) { renderPlay(); continue; }
      renderPlay();
      continue;
    }
    if (m.phase !== 'turn') { renderPlay(); return; }
    const p = m.players[m.turn];
    if (!p || p.isHuman) { renderPlay(); return; }
    state.busy = true;
    await wait(70 + Math.random() * 70);
    const decision = botDecide(m, m.turn);
    let result;
    if (decision === 'stay') result = playerStay(m);
    else result = playerHit(m);
    state.busy = false;
    reactToEvent(m.lastEvent);
    if (result?.needsTarget) {
      renderPlay();
      continue; // bot will pick in next loop
    }
    if (result?.roundEnd || result?.matchEnd || result?.flip7 || m.phase === 'round_end' || m.phase === 'match_end') {
      renderPlay();
      await afterMove(result);
      return;
    }
    renderPlay();
  }
}

async function onHit() {
  if (state.busy) return;
  const m = state.match;
  if (m.phase !== 'turn' || !m.players[m.turn].isHuman) return;
  SFX.click();
  state.busy = true;
  const result = playerHit(m);
  state.busy = false;
  await afterMove(result);
}
async function onStay() {
  if (state.busy) return;
  const m = state.match;
  if (m.phase !== 'turn' || !m.players[m.turn].isHuman) return;
  SFX.click();
  state.busy = true;
  const result = playerStay(m);
  state.busy = false;
  await afterMove(result);
}
async function onPickTarget(tid) {
  if (state.busy) return;
  SFX.click();
  state.busy = true;
  const result = resolveAction(state.match, tid);
  state.busy = false;
  await afterMove(result);
}

function renderSetup() {
  const cast = $('#cast');
  cast.innerHTML = '';
  ONES.forEach((h) => {
    const el = document.createElement('div');
    el.className = `cast-card ${state.hero === h.id ? 'on' : ''}`;
    el.innerHTML = `<img src="${h.portrait}" alt="${h.name}" loading="lazy"><div class="meta"><span class="meta-name">${h.name}</span><span class="meta-tok">1/1 · #${h.token}</span></div>`;
    el.onclick = () => {
      state.hero = h.id;
      saveProgress();
      SFX.click();
      renderSetup();
    };
    cast.appendChild(el);
  });
  $('#wins-pill').textContent = `Wins ${state.wins} · 1/1s ${ONES.length}`;
  $$('#mode-picks label').forEach((lab) => {
    lab.classList.toggle('on', lab.dataset.mode === state.mode);
  });
  syncMuteButton($('#mute-btn'));
}

function renderGallery() {
  const grid = $('#gallery-grid');
  if (!grid) return;
  $('#gallery-count').textContent = String(ONES.length);
  grid.innerHTML = '';
  ONES.forEach((h) => {
    const el = document.createElement('div');
    el.className = 'gallery-card';
    el.innerHTML = `
      <div class="gc-art" style="background-image:url('${h.portrait}')"></div>
      <div class="gc-frame"></div>
      <div class="gc-mark">JOKER</div>
      <div class="gc-name">${h.name}</div>
      <div class="gc-tok">#${h.token}</div>`;
    grid.appendChild(el);
  });
}

function openGallery() {
  SFX.click();
  renderGallery();
  $('#overlay-gallery').classList.add('on');
}
function closeGallery() {
  SFX.click();
  $('#overlay-gallery').classList.remove('on');
}

function startMatch() {
  const heroes = [state.hero];
  const pool = ONES.map((r) => r.id).filter((id) => id !== state.hero);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  heroes.push(...pool.slice(0, 3));
  const names = heroes.map((id, i) => (i === 0 && state.mode === 'bots' ? 'YOU' : BY_ID[id].name));
  const humans = state.mode === 'bots'
    ? [true, false, false, false]
    : [true, true, true, true];
  if (state.mode === 'pass') {
    names[0] = BY_ID[heroes[0]].name;
  }
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  state.match = createMatch({ heroes, names, humans, seed, winScore: WIN_SCORE });
  // Label pass players P1-P4 with hero names
  if (state.mode === 'pass') {
    state.match.players.forEach((p, i) => { p.name = `${BY_ID[p.heroId].name}`; });
  } else {
    state.match.players[0].name = 'YOU';
    state.match.players.forEach((p, i) => {
      if (i > 0) p.name = BY_ID[p.heroId].name;
    });
  }
  startRound(state.match);
  showScreen('play');
  state.toast = 'Hit for points. Stay to bank. Bust on a duplicate.';
  state.toastKind = '';
  renderPlay();
  maybeBotTurn();
}

function bind() {
  $('#btn-play').onclick = () => { unlockAudioFromGesture(); SFX.click(); showScreen('setup'); renderSetup(); };
  $('#btn-how').onclick = () => { SFX.click(); showScreen('how'); };
  $('#btn-how-back').onclick = () => { SFX.click(); showScreen('title'); };
  $('#btn-setup-back').onclick = () => { SFX.click(); showScreen('title'); };
  $('#btn-start').onclick = () => { unlockAudioFromGesture(); SFX.click(); startMatch(); applyMusicState(); };
  $$('#mode-picks label').forEach((lab) => {
    lab.onclick = () => {
      state.mode = lab.dataset.mode;
      SFX.click();
      renderSetup();
    };
  });
  $('#btn-hit').onclick = onHit;
  $('#btn-stay').onclick = onStay;
  $('#mute-btn').onclick = () => {
    toggleMuteFromUi();
    syncMuteButton($('#mute-btn'));
    SFX.click();
  };
  $('#btn-gallery').onclick = openGallery;
  $('#btn-gallery-close').onclick = closeGallery;
  const galOv = $('#overlay-gallery');
  if (galOv && !galOv.dataset.bound) {
    galOv.dataset.bound = '1';
    galOv.addEventListener('click', (e) => {
      if (e.target === galOv) closeGallery(); // backdrop only — never startMatch / clear saves
    });
  }
  // Click Joker badge opens gallery
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('#badges .badge');
    if (b && /JOKER/i.test(b.textContent || '')) openGallery();
  });
  $('#btn-reset').onclick = () => {
    if (!state.match) return;
    SFX.click();
    if (confirm('Reset this match?')) {
      showScreen('setup');
      renderSetup();
    }
  };
  $('#btn-menu').onclick = () => {
    SFX.click();
    showScreen('title');
  };

  window.addEventListener('keydown', (e) => {
    if (state.screen !== 'play') return;
    if (e.key === 'h' || e.key === 'H' || e.key === ' ') { e.preventDefault(); onHit(); }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); onStay(); }
    if (e.key === 'm' || e.key === 'M') {
      toggleMuteFromUi();
      syncMuteButton($('#mute-btn'));
    }
  });
}

// Test / debug hooks
window.__MWFLIP = {
  get state() { return state; },
  startMatch,
  showScreen,
  renderPlay,
  renderSetup,
  scoreLine,
  WIN_SCORE,
  FLIP7_BONUS,
  ROSTER,
  ONES,
  ONES_SOURCE,
  JOKER_HEROES,
  isJokerCard,
  heroForNumber,
  playerHit,
  playerStay,
  resolveAction,
  stepFlip3,
  advanceToNextRound,
  createMatch,
  startRound,
  activePlayers,
  ready: true,
  applyMusicState,
  isMuted,
  setMuted,
};

loadProgress();
bind();
showScreen('title');
renderSetup();
syncMuteButton($('#mute-btn'));
