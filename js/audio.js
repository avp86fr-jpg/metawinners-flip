/**
 * MetaWinners Flip audio — WebAudio SFX + original lounge loop.
 * Music starts only after a real user gesture (autoplay policy).
 * Mute preference persists; one loop instance; pauses when tab hidden.
 */
let ctx = null;
let muted = false;
let musicUnlocked = false;
let musicWanted = true; // user wants music when unmuted (after unlock)
let musicEl = null;
let musicStarting = false;
let gestureBound = false;

const MUTE_KEY = 'mwflip_mute';
const MUSIC_SRC_MP3 = 'assets/audio/mw_flip_lounge_loop.mp3';
const MUSIC_SRC_OGG = 'assets/audio/mw_flip_lounge_loop.ogg';

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
  applyMusicState();
}

export function loadMute() {
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch {}
  return muted;
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep(freq, dur, type = 'sine', gain = 0.028, at = 0) {
  if (muted) return;
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime + at;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

export const SFX = {
  flip() { beep(420, 0.08, 'triangle', 0.05); beep(660, 0.06, 'sine', 0.03, 0.05); },
  stay() { beep(280, 0.12, 'sine', 0.04); },
  bust() { beep(160, 0.18, 'sawtooth', 0.05); beep(90, 0.25, 'square', 0.03, 0.08); },
  save() { beep(520, 0.1, 'sine', 0.04); beep(780, 0.12, 'triangle', 0.04, 0.08); },
  flip7() {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.16, 'sine', 0.045, i * 0.09));
  },
  click() { beep(700, 0.04, 'square', 0.025); },
  win() { [440, 554, 659, 880].forEach((f, i) => beep(f, 0.18, 'triangle', 0.04, i * 0.1)); },
};

function ensureMusicEl() {
  if (musicEl) return musicEl;
  let a = document.querySelector('audio[data-mw-music]');
  if (!a) {
    a = new Audio();
    a.dataset.mwMusic = '1';
    a.setAttribute('playsinline', '');
    a.setAttribute('aria-hidden', 'true');
    a.preload = 'auto';
    a.loop = true;
    a.volume = 0.28;
    if (a.canPlayType('audio/ogg; codecs="vorbis"')) a.src = MUSIC_SRC_OGG;
    else a.src = MUSIC_SRC_MP3;
    // Keep in DOM for lifecycle / inspection; visually hidden
    a.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-9999px';
    (document.body || document.documentElement).appendChild(a);
  }
  musicEl = a;
  return a;
}

function tabVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

export function applyMusicState() {
  const a = musicEl || ensureMusicEl();
  if (muted || !musicUnlocked || !musicWanted || !tabVisible()) {
    if (!a.paused) {
      try { a.pause(); } catch {}
    }
    return;
  }
  if (a.paused && !musicStarting) {
    musicStarting = true;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.catch(() => { /* autoplay still blocked — wait for next gesture */ })
        .finally(() => { musicStarting = false; });
    } else {
      musicStarting = false;
    }
  }
}

/** Call from a real click/tap/keydown. Unlocks + tries to start if unmuted. */
export function unlockAudioFromGesture() {
  musicUnlocked = true;
  try { ac(); } catch {}
  applyMusicState();
}

export function bindAudioGestures(root = document) {
  if (gestureBound) return;
  gestureBound = true;
  const once = () => unlockAudioFromGesture();
  // Capture first interaction anywhere in the app
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
    root.addEventListener(ev, once, { capture: true, passive: true });
  });
  // Pause when tab/app hidden; resume when visible (if unmuted)
  const syncVis = () => applyMusicState();
  document.addEventListener('visibilitychange', syncVis);
  window.addEventListener('pagehide', () => { try { musicEl?.pause(); } catch {} });
  window.addEventListener('pageshow', syncVis);
  window.addEventListener('blur', () => {
    if (document.visibilityState === 'hidden') { try { musicEl?.pause(); } catch {} }
  });
  window.addEventListener('focus', syncVis);
}

export function syncMuteButton(btn) {
  if (!btn) return;
  const on = !muted;
  btn.textContent = on ? '🔊' : '🔇';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = on
    ? 'Sound on — music & effects (M). Click to mute.'
    : 'Muted — music & effects off (M). Click to unmute.';
  btn.setAttribute('aria-label', btn.title);
}

/** Toggle mute; if unmuting, treat as gesture unlock. */
export function toggleMuteFromUi() {
  const next = !muted;
  if (!next) {
    // unmuting
    musicUnlocked = true;
    musicWanted = true;
  }
  setMuted(next);
  return muted;
}
