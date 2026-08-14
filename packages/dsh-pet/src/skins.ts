/**
 * Pet skin registry — a pet skin is a directory under `assets/` holding a
 * spritesheet + pet.json (+ optional tracks.json), plus the animation mapping
 * the host state machine uses. Skins let the plugin offer multiple pets from
 * one install; the default whale-girl stays byte-compatible with the original.
 * @module @linxin666/dsh-pet/skins
 */

import type { PetAnimation } from './state.ts'

/** Identifiers of the built-in pet skins. */
export type PetSkinId = 'whale' | 'aemeath-bust'

/** Per-skin row index of one animation track (spritesheet row order). */
export type SkinRowMap = Record<PetAnimation, number>

/** Per-skin animation track definitions (frames/durations/loop). */
export interface SkinTrackDef {
  /** Frame indices (columns) played in order. */
  frames: readonly number[]
  /** Per-frame duration in ms. */
  durations: readonly number[]
  /** Whether the track loops; a non-looping track hands off to fallback. */
  loop: boolean
  /** Track to play after a non-looping track finishes. */
  fallback?: PetAnimation
}

/** One registered pet skin. */
export interface PetSkinDef {
  id: PetSkinId
  /** Human-readable name shown in the pet picker. */
  displayName: string
  /** Browser-facing asset prefix (`/pet/<dir>/*`). */
  assetDir: string
  /** Default pet name when this skin is selected. */
  defaultName: string
  /** Row of each animation inside this skin's spritesheet. */
  rows: SkinRowMap
  /** Animation tracks (frame timing) for this skin. */
  tracks: Record<PetAnimation, SkinTrackDef>
  /** Number of rows the client should detect/trim against. */
  rowCount: number
}

/** Shared row layout for Codex-contract skins (whale + any 9-row atlas). */
const codexRows: SkinRowMap = {
  idle: 0,
  'running-right': 1,
  'running-left': 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8,
  // Tool-specific tracks fall back to the generic running row when the skin
  // has no dedicated rows (whale); aemeath-bust overrides these below.
  fetching: 7,
  searching: 7,
  analyzing: 7,
  building: 7,
  chatting: 7,
}

/** Frame timings shared by every whale track (soft slow-healing feel). */
const whaleTracks: Record<PetAnimation, SkinTrackDef> = {
  idle: { frames: [0, 1, 2, 3, 4, 5], durations: [400, 400, 500, 400, 400, 500], loop: true },
  'running-right': { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [225, 225, 225, 225, 225, 225, 225, 225], loop: true },
  'running-left': { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [225, 225, 225, 225, 225, 225, 225, 225], loop: true },
  waving: { frames: [0, 1, 2, 3], durations: [350, 350, 350, 350], loop: true },
  jumping: { frames: [0, 1, 2, 3, 4], durations: [300, 300, 300, 350, 350], loop: false, fallback: 'idle' },
  failed: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [450, 450, 450, 500, 550, 600, 450, 450], loop: false, fallback: 'idle' },
  waiting: { frames: [0, 1, 2, 3, 4, 5], durations: [450, 450, 500, 450, 450, 500], loop: true },
  running: { frames: [0, 1, 2, 3, 4, 5], durations: [250, 250, 250, 250, 250, 250], loop: true },
  review: { frames: [0, 1, 2, 3, 4, 5], durations: [550, 550, 550, 550, 550, 550], loop: true },
  fetching: { frames: [0, 1, 2, 3, 4, 5], durations: [250, 250, 250, 250, 250, 250], loop: true },
  searching: { frames: [0, 1, 2, 3, 4, 5], durations: [250, 250, 250, 250, 250, 250], loop: true },
  analyzing: { frames: [0, 1, 2, 3, 4, 5], durations: [250, 250, 250, 250, 250, 250], loop: true },
  building: { frames: [0, 1, 2, 3, 4, 5], durations: [250, 250, 250, 250, 250, 250], loop: true },
  chatting: { frames: [0, 1, 2, 3, 4, 5], durations: [250, 250, 250, 250, 250, 250], loop: true },
}

/** The default whale-girl skin (backward compatible with the original plugin). */
export const whaleSkin: PetSkinDef = {
  id: 'whale',
  displayName: '鲸鱼娘',
  assetDir: 'whale',
  defaultName: '鲸鱼娘',
  rows: codexRows,
  tracks: whaleTracks,
  rowCount: 9,
}

/**
 * The aemeath bust skin — bust/close-up pixel art (A1 screen expressions +
 * A3 tool-closeup rows). Rows 0-8 follow the Codex contract for compatibility
 * with the frame-count scanner; rows 9-13 are the tool-specific bust tracks.
 * Filled in by the atlas build script (assets/aemeath-bust/).
 */
export const aemeathBustSkin: PetSkinDef = {
  id: 'aemeath-bust',
  displayName: '爱弥斯·半身像素',
  assetDir: 'aemeath-bust',
  defaultName: '爱弥斯',
  rows: {
    idle: 0,
    'running-right': 1,
    'running-left': 2,
    waving: 3,
    jumping: 4,
    failed: 5,
    waiting: 6,
    running: 7,
    review: 8,
    fetching: 9,
    searching: 10,
    analyzing: 11,
    building: 12,
    chatting: 13,
  },
  tracks: {
    idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [300, 300, 300, 300, 300, 300, 300, 300], loop: true },
    'running-right': { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [250, 250, 250, 250, 250, 250, 250, 250], loop: true },
    'running-left': { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [250, 250, 250, 250, 250, 250, 250, 250], loop: true },
    waving: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [300, 300, 300, 300, 300, 300, 300, 300], loop: true },
    jumping: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [260, 260, 260, 320, 320, 320, 320, 320], loop: false, fallback: 'idle' },
    failed: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [350, 350, 350, 420, 420, 420, 350, 350], loop: false, fallback: 'idle' },
    waiting: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [400, 400, 400, 400, 400, 400, 400, 400], loop: true },
    running: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [250, 250, 250, 250, 250, 250, 250, 250], loop: true },
    review: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [400, 400, 400, 400, 400, 400, 400, 400], loop: true },
    fetching: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [250, 250, 250, 250, 250, 250, 250, 250], loop: true },
    searching: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [250, 250, 250, 250, 250, 250, 250, 250], loop: true },
    analyzing: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [250, 250, 250, 250, 250, 250, 250, 250], loop: true },
    building: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [250, 250, 250, 250, 250, 250, 250, 250], loop: true },
    chatting: { frames: [0, 1, 2, 3, 4, 5, 6, 7], durations: [280, 280, 280, 280, 280, 280, 280, 280], loop: true },
  },
  rowCount: 16,
}

/** All built-in skins, keyed by id. */
export const PET_SKINS: Record<PetSkinId, PetSkinDef> = {
  whale: whaleSkin,
  'aemeath-bust': aemeathBustSkin,
}

/** Resolve a skin id (unknown ids fall back to whale). */
export function skinOf(id: string | undefined): PetSkinDef {
  return (id !== undefined && id in PET_SKINS) ? PET_SKINS[id as PetSkinId] : whaleSkin
}
