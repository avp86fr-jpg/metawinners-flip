/**
 * MetaWinners Flip roster — all 25 confirmed on-chain 1/1 Types.
 * Source of truth: /workspace/premium/studio/nft_refs/one_of_ones/INDEX.md
 * Portraits: derived 384px thumbs from unmodified studio HD JPEGs (never re-encoded originals).
 * Gold Mage note: NFT plate includes helm horns; in-game SNES sprites elsewhere use crown-only —
 * collectible Joker faces use the authentic 1/1 artwork.
 */

export const ONES_SOURCE = {
  index: '/workspace/premium/studio/nft_refs/one_of_ones/INDEX.md',
  originals: '/workspace/premium/studio/nft_refs/one_of_ones/',
  contract: '0x74f70713b0515e9f520d6c764352e45e227839b7',
  count: 25,
};

/** Full confirmed 1/1 cast (25). token IDs from INDEX.md — not invented. */
export const ONES = [
  { id: 'hockey_mask', name: 'HOCKEY MASK', token: 1, accent: '#e11d2e', glow: '#e11d2e', blurb: 'Goalie mask. Misty woods.' },
  { id: 'chaos', name: 'CHAOS', token: 2, accent: '#6a2cff', glow: '#39ff14', blurb: 'Cracked helm. Joker grin.' },
  { id: 'chief', name: 'CHIEF', token: 3, accent: '#ffb020', glow: '#ffb020', blurb: 'Spartan helm. Stadium lights.' },
  { id: 'ice', name: 'ICE', token: 4, accent: '#4ec4ff', glow: '#4ec4ff', blurb: 'Bone-skull. Ice crystals.' },
  { id: 'steampunk', name: 'STEAMPUNK', token: 5, accent: '#c9a227', glow: '#e8c76b', blurb: 'Brass goggles. Gears.' },
  { id: 'sheikh', name: 'SHEIKH', token: 6, accent: '#d4af37', glow: '#ffd700', blurb: 'Ghutra. Gold trim.' },
  { id: 'assimilator', name: 'ASSIMILATOR', token: 7, accent: '#33a0ff', glow: '#33a0ff', blurb: 'Cables. Cyber eye.' },
  { id: 'fire', name: 'FIRE', token: 8, accent: '#ff6a20', glow: '#ff6a20', blurb: 'Skull jaw. Flames.' },
  { id: 'hunter', name: 'HUNTER', token: 194, accent: '#5aaf40', glow: '#5aaf40', blurb: 'Predator helm. Jade.' },
  { id: 'optimus', name: 'OPTIMUS', token: 295, accent: '#33e0ff', glow: '#33e0ff', blurb: 'White robot. Cyan trim.' },
  { id: 'bloodbath', name: 'BLOODBATH', token: 322, accent: '#ff3344', glow: '#ff3344', blurb: 'Crimson symbiote.' },
  { id: 'arachnia', name: 'ARACHNIA', token: 406, accent: '#ff2244', glow: '#ff2244', blurb: 'Spider-leg visor.' },
  { id: 'cowboy', name: 'COWBOY', token: 814, accent: '#22e0c8', glow: '#ff7a18', blurb: 'Wide brim. Lasso.' },
  { id: 'blue', name: 'BLUE', token: 955, accent: '#3aa0ff', glow: '#3aa0ff', blurb: 'Teal visor. Dreads.' },
  { id: 'gold_mage', name: 'GOLD MAGE', token: 1761, accent: '#c8962a', glow: '#33e0ff', blurb: 'Gold dragon helm. 1/1 plate.' },
  { id: 'alien', name: 'ALIEN', token: 2114, accent: '#4a8a3a', glow: '#4a8a3a', blurb: 'Insect eyes. Carapace.' },
  { id: 'elemental', name: 'ELEMENTAL', token: 2259, accent: '#40d0c0', glow: '#40d0c0', blurb: 'Crystal visor. Vines.' },
  { id: 'digital_punk', name: 'DIGITAL PUNK', token: 3408, accent: '#ff4ad4', glow: '#39ff14', blurb: 'Bubble helm. Neon city.' },
  { id: 'manga', name: 'MANGA', token: 4130, accent: '#d0d0d0', glow: '#ffffff', blurb: 'Ink helm. Halftone.' },
  { id: 'mask', name: 'MASK', token: 5314, accent: '#8a8a90', glow: '#c0c0c8', blurb: 'Respirator. Shearling.' },
  { id: 'gladiator', name: 'GLADIATOR', token: 6937, accent: '#c04020', glow: '#ff5530', blurb: 'Mohawk crest. Twin swords.' },
  { id: 'neural', name: 'NEURAL', token: 8132, accent: '#a040ff', glow: '#ff40c8', blurb: 'Neon circuits.' },
  { id: 'poison', name: 'POISON', token: 8280, accent: '#ff7a18', glow: '#39ff14', blurb: 'Black symbiote. Official 1/1.' },
  { id: 'quarterback', name: 'QUARTERBACK', token: 8878, accent: '#ff5520', glow: '#ff5520', blurb: 'Football helm. Pads.' },
  { id: 'medusa', name: 'MEDUSA', token: 8968, accent: '#40a060', glow: '#40a060', blurb: 'Snake hair. Emerald.' },
].map((r) => ({
  ...r,
  tag: '1/1',
  portrait: `assets/portraits/1of1/${r.id}.jpg`,
  unlock: 0,
}));

export const BY_ID = Object.fromEntries(ONES.map((r) => [r.id, r]));

/** Playable select — keep light; all 25 still appear as Jokers / gallery. */
export const ROSTER = ONES;

export const STARTERS = ['chaos', 'gold_mage', 'sheikh', 'poison'];

export function unlockedIds() {
  return ONES.map((r) => r.id);
}

export const NOT_ONE_OF_ONES = ['BOXER', 'SAMURAI', 'SYNTHWAVE', 'T1000', 'M1', 'M2'];
