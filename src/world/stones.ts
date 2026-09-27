import { MAX_STONE } from './constants'

/**
 * Stone structure layout shared by the renderer and anything that needs the
 * height of a stone tile (hover highlight, particle puffs).
 *
 * 1 piece: a squat boulder.
 * 2..MAX_STONE pieces: a round brick tower, one brick drum per piece, on a
 * plinth and topped with a stone cap. A full tower also gets a stone lantern
 * crown. Neighbouring towers are joined by capped brick walls.
 */

export const BOULDER_RADIUS = 0.4
export const BOULDER_SQUASH = 0.65
/** How far the boulder sinks into the ground. */
export const BOULDER_SINK = 0.06

export const TOWER_RADIUS = 0.42
export const DRUM_H = 0.4
/** Towers sink a little so they sit firmly on sloped/bevelled ground. */
export const TOWER_SINK = 0.08
/** Height of the plinth before the first brick drum starts. */
export const DRUM_START = 0.1
export const CAP_H = 0.2
export const CROWN_H = 0.78
export const WALL_THICKNESS = 0.5

export const boulderTop = () => BOULDER_RADIUS * BOULDER_SQUASH * 2 - BOULDER_SINK

/** Top of the brick drums of a tower with `count` pieces, relative to the ground. */
export const drumsTop = (count: number) => -TOWER_SINK + DRUM_START + count * DRUM_H

/** Height of a stone structure above the tile surface. */
export function stackHeight(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return boulderTop()
  return drumsTop(count) + CAP_H + (count >= MAX_STONE ? CROWN_H : 0)
}
