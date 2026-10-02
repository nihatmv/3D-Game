import { MAX_LEVEL, MAX_STONE, TileType } from './constants'
import { MAX_PLANTS_PER_TILE } from './plantRules'
import { idx, touchesLand } from './grid'
import type { Tool } from '../store/useIslandStore'

type TileState = {
  height: Uint8Array
  type: Uint8Array
  stones: Uint8Array
  locked: Uint8Array
  plants: ReadonlyArray<{ tile: number }>
}

/**
 * Would the tool (or its shift-reverse) do anything on this tile? Mirrors the
 * store actions so the hover highlight can warn before a click is wasted.
 */
export function canApply(s: TileState, tool: Tool, reverse: boolean, x: number, z: number): boolean {
  const i = idx(x, z)
  if (s.locked[i]) return false
  const h = s.height[i]
  const water = s.type[i] === TileType.Water
  switch (tool) {
    case 'soil':
      return reverse ? h > 0 : water || (h > 0 ? h < MAX_LEVEL : touchesLand(s.height, x, z))
    case 'water':
      return reverse ? water : h > 0 && !(water && h <= 1)
    case 'stone':
      return reverse ? s.stones[i] > 0 : h > 0 && !water && s.stones[i] < MAX_STONE
    case 'seeds': {
      let n = 0
      for (const p of s.plants) if (p.tile === i) n++
      return reverse ? n > 0 : h > 0 && !water && s.stones[i] === 0 && n < MAX_PLANTS_PER_TILE
    }
  }
}
