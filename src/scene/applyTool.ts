import type { Vector3 } from 'three'
import { useIslandStore, type TileCoord, type Tool } from '../store/useIslandStore'
import { HALF, SEA_Y, surfaceY } from '../world/constants'
import { idx } from '../world/grid'
import { stackHeight } from '../world/stones'
import { emit, type PuffKind } from './puffs'

/** World y of the visible surface on a tile right now (water, stack, ground or sea). */
function surfaceAt(i: number): number {
  const { height, type, pondLevel, stones } = useIslandStore.getState()
  if (!Number.isNaN(pondLevel[i])) return pondLevel[i]
  if (height[i] === 0) return SEA_Y
  return surfaceY(height[i], type[i]) + stackHeight(stones[i])
}

/**
 * Apply the active tool (or its reverse) to one tile and play a puff for it.
 * `point` is the world hit point; `first` is true for the first tile of a stroke.
 */
export function applyTool(tool: Tool, t: TileCoord, reverse: boolean, point: Vector3, first: boolean): boolean {
  const s = useIslandStore.getState()
  const i = idx(t.x, t.z)
  const cx = t.x - HALF + 0.5
  const cz = t.z - HALF + 0.5
  const puff = (kind: PuffKind, count?: number) => emit(kind, cx, surfaceAt(i) + 0.05, cz, count)

  switch (tool) {
    case 'soil': {
      const ok = reverse ? s.lower(t.x, t.z) : s.raise(t.x, t.z)
      if (ok) puff(s.height[i] === 0 ? 'splash' : 'dirt')
      return ok
    }
    case 'water': {
      const ok = reverse ? s.fill(t.x, t.z) : s.dig(t.x, t.z)
      if (ok) puff(reverse ? 'dirt' : 'splash')
      return ok
    }
    case 'stone': {
      // Reverse: puff where the removed piece was, before it disappears.
      const top = surfaceAt(i)
      const ok = reverse ? s.removeStone(t.x, t.z) : s.addStone(t.x, t.z)
      if (ok) emit('dust', cx, reverse ? top : surfaceAt(i) - 0.1, cz)
      return ok
    }
    case 'seeds': {
      if (reverse) {
        const ok = s.removePlants(t.x, t.z)
        if (ok) puff('leaves', 10)
        return ok
      }
      // A click scatters a handful; dragging sows a lighter trail.
      const count = first ? 3 + Math.floor(Math.random() * 3) : 2
      const grown = s.scatterSeeds(point.x, point.z, count, first ? 1.2 : 0.6)
      if (grown > 0) emit('leaves', point.x, point.y + 0.05, point.z, 3 + grown * 2)
      if (grown < count) emit('fizzle', point.x, point.y + 0.05, point.z)
      return grown > 0
    }
  }
}
