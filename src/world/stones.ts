/**
 * Stone stack layout shared by the renderer and anything that needs the
 * height of a stack (hover highlight, later: plants/particles).
 *
 * Piece 1 is a squat boulder; pieces 2..4 are beveled blocks that get a little
 * smaller as they go up, so a full stack reads like a cairn.
 */

export const BOULDER_RADIUS = 0.4
export const BOULDER_SQUASH = 0.65
/** How far the boulder sinks into the ground. */
export const BOULDER_SINK = 0.06
/** Blocks nest slightly into the piece below them. */
export const BLOCK_NEST = 0.05

export const BLOCKS = [
  { w: 0.72, h: 0.34 },
  { w: 0.62, h: 0.3 },
  { w: 0.52, h: 0.26 },
]

export const boulderTop = () => BOULDER_RADIUS * BOULDER_SQUASH * 2 - BOULDER_SINK

/** Height of a stack of `count` pieces above the tile surface. */
export function stackHeight(count: number): number {
  if (count <= 0) return 0
  let h = boulderTop()
  for (let k = 0; k < count - 1; k++) h += BLOCKS[k].h - BLOCK_NEST
  return h
}
