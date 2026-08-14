/**
 * Spritesheet geometry and animation tracks, skin-aware.
 *
 * The atlas follows the Codex/hatch-pet contract: 8 columns of 192x208
 * cells. Row ORDER is per-skin (see src/skins.ts): the whale-girl keeps the
 * original 9-row Codex order (0 idle ... 8 review); aemeath-bust extends it
 * with tool-specific bust rows (9 fetching ... 13 chatting).
 *
 * Frame counts and per-frame durations are per-track definitions below; the
 * client trims each track to the row's real frame count (detected from the
 * atlas or read from pet.json) so transparent trailing cells never render.
 * @module @linxin666/dsh-pet/client/spritesheet
 */

import type { PetAnimation } from '../state.ts'
import { whaleSkin, type PetSkinDef } from '../skins.ts'

/** Atlas cell size in px (Codex contract). */
export const FRAME_WIDTH = 192
export const FRAME_HEIGHT = 208
/** Columns per row (max frames per track). */
export const FRAME_COLUMNS = 8

export type { PetAnimation }

/** Backward-compatible default track definitions (whale skin). */
export const TRACKS = whaleSkin.tracks

/** Row index of one animation track for the whale skin (legacy helper). */
export function rowOfTrack(animation: PetAnimation): number {
  return whaleSkin.rows[animation]
}

/** Row index of one animation track within a given skin. */
export function rowOfTrackFor(animation: PetAnimation, skin: PetSkinDef): number {
  return skin.rows[animation]
}

/**
 * Background-position (px) of one frame cell within the scaled atlas.
 * The background image is scaled by `scale` (element size / cell size), and
 * background-position offsets are applied in SCALED coordinates — using raw
 * atlas coordinates here would drift each frame by the scale factor and
 * render torn/overlapping frames.
 */
export function framePosition(row: number, col: number, scale = 1): { x: number; y: number } {
  return { x: -col * FRAME_WIDTH * scale, y: -row * FRAME_HEIGHT * scale }
}

/** Total duration of one track, ms. */
export function trackDuration(track: { durations: readonly number[] }): number {
  return track.durations.reduce((sum, d) => sum + d, 0)
}

/**
 * Detect how many frames each row actually carries by scanning the decoded
 * atlas for non-transparent cells (rows may hold 4-8 frames; the unused
 * trailing cells are fully transparent). Rows whose every sample is
 * transparent report 0.
 * @param image - the fully decoded spritesheet.
 * @param rowCount - how many rows to scan (per-skin).
 * @returns per-row frame counts, length rowCount.
 */
export function detectFrameCounts(image: HTMLImageElement, rowCount = 9): number[] {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (ctx === null) return Array.from({ length: rowCount }, () => FRAME_COLUMNS)
  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const counts: number[] = []
  const stride = FRAME_COLUMNS * FRAME_WIDTH
  const probeStep = 8
  const margin = 12
  for (let row = 0; row < rowCount; row++) {
    let count = 0
    for (let col = 0; col < FRAME_COLUMNS; col++) {
      let hasContent = false
      const x0 = col * FRAME_WIDTH
      const y0 = row * FRAME_HEIGHT
      for (let y = y0 + margin; y < y0 + FRAME_HEIGHT - margin && !hasContent; y += probeStep) {
        for (let x = x0 + margin; x < x0 + FRAME_WIDTH - margin && !hasContent; x += probeStep) {
          const idx = (y * stride + x) * 4
          if ((data[idx + 3] ?? 0) > 8) hasContent = true
        }
      }
      if (hasContent) count += 1
    }
    counts.push(count)
  }
  return counts
}

/**
 * Trim a track to the actual frame count of its row. A row with 0 detected
 * frames degrades to the first frame (the atlas is still loading or corrupt)
 * so the pet never renders blank.
 */
export function trimTrack(track: { frames: readonly number[]; durations: readonly number[]; loop: boolean; fallback?: PetAnimation }, frameCount: number): { frames: readonly number[]; durations: readonly number[]; loop: boolean; fallback?: PetAnimation } {
  const n = Math.max(1, Math.min(frameCount, track.frames.length))
  return {
    frames: track.frames.slice(0, n),
    durations: track.durations.slice(0, n),
    loop: track.loop,
    ...(track.fallback === undefined ? {} : { fallback: track.fallback }),
  }
}
