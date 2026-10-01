import { useIslandStore } from '../store/useIslandStore'
import { GRID, HALF, SEA_Y, TileType, surfaceY } from '../world/constants'
import { idx } from '../world/grid'
import { isTree } from '../world/plantRules'
import { tilesInArea, type Quest } from './quests'

/** Where a landmark stands: its anchor tile and world-space origin. */
export type Placement = { tile: number; x: number; y: number; z: number }

/** Tiles of open ocean the pier reaches over, beyond its anchor. */
export const PIER_TILES = 3

/** Which way along x the pier reaches: -1 = west, toward where the ship waits (top-left of the default view). */
export const PIER_DIR = -1

const centreX = (i: number) => (i % GRID) - HALF + 0.5
const centreZ = (i: number) => Math.floor(i / GRID) - HALF + 0.5

/** Best tile by `score` (higher wins), ties broken by distance to the area centre. */
function pick(tiles: number[], cx: number, cz: number, score: (i: number) => number): number | undefined {
  let best: number | undefined
  let bestScore = -Infinity
  let bestDist = Infinity
  for (const i of tiles) {
    const sc = score(i)
    const d = Math.hypot((i % GRID) - cx, Math.floor(i / GRID) - cz)
    if (sc > bestScore || (sc === bestScore && d < bestDist)) {
      best = i
      bestScore = sc
      bestDist = d
    }
  }
  return best
}

const groundY = (i: number) => {
  const { height, type } = useIslandStore.getState()
  return surfaceY(height[i], type[i])
}

/**
 * Choose where the quest's landmark goes, use up the visitor's building
 * material there (stones become the lighthouse, and so on), and lock its
 * footprint so it can't be dug away. Mutates the island store.
 */
export function placeLandmark(q: Quest, placed: Record<string, Placement>): Placement {
  const island = useIslandStore.getState()
  const { height, type, stones, plants } = island
  const area = tilesInArea(q.area)
  const { x: ax, z: az } = q.area
  const isLand = (i: number) => height[i] > 0 && type[i] !== TileType.Water && !island.locked[i]
  const land = area.filter(isLand)
  const fallback = idx(ax, az)

  switch (q.landmark) {
    case 'lighthouseBase':
    case 'lighthouseTop': {
      const base = q.anchorOf ? placed[q.anchorOf] : undefined
      const tile = base?.tile ?? pick(land, ax, az, (i) => stones[i]) ?? fallback
      island.claimTiles(area, [tile], { stones: true })
      island.claimTiles([tile], [], { plants: true })
      return { tile, x: centreX(tile), y: groundY(tile), z: centreZ(tile) }
    }

    case 'pondRipples': {
      let water = area.filter((i) => type[i] === TileType.Water)
      if (water.length === 0) {
        // Skipped: dig a small pond so the landmark has water to sit on.
        island.dig(ax, az)
        island.dig(ax + 1, az)
        water = area.filter((i) => type[i] === TileType.Water)
      }
      if (water.length === 0) water = [fallback]
      island.claimTiles(water, water, { stones: true, plants: true })
      const { pondLevel } = useIslandStore.getState()
      const tile = water[0]
      const y = Number.isNaN(pondLevel[tile]) ? groundY(tile) : pondLevel[tile]
      const x = water.reduce((s, i) => s + centreX(i), 0) / water.length
      const z = water.reduce((s, i) => s + centreZ(i), 0) / water.length
      return { tile, x, y, z }
    }

    case 'pier': {
      // Outermost land on the row (in PIER_DIR), then reach out over the sea toward the ship.
      let ex = HALF
      for (let k = 0; k < GRID; k++) {
        const x = PIER_DIR > 0 ? GRID - 1 - k : k
        if (height[idx(x, az)] > 0) {
          ex = x
          break
        }
      }
      const tile = idx(ex, az)
      const over: number[] = []
      for (let k = 1; k <= PIER_TILES; k++) {
        const x = ex + k * PIER_DIR
        if (x >= 0 && x < GRID) over.push(idx(x, az))
      }
      island.claimTiles([tile, ...over], [tile, ...over], { stones: true, plants: true })
      // The deck starts at the tile's seaward edge.
      return { tile, x: centreX(tile) + PIER_DIR * 0.5, y: SEA_Y, z: centreZ(tile) }
    }

    case 'bigTree': {
      const tile =
        pick(land, ax, az, (i) => {
          let n = 0
          for (const p of plants) if (p.tile === i) n += isTree(p.kind) ? 10 : 1
          return n
        }) ?? fallback
      island.claimTiles([tile], [tile], { stones: true, plants: true })
      return { tile, x: centreX(tile), y: groundY(tile), z: centreZ(tile) }
    }
  }
}

/** Where the pier stands, if its quest is built (quests are data, so look it up by landmark kind). */
export function findPier(placed: Record<string, Placement>, quests: Quest[]): Placement | undefined {
  const q = quests.find((q) => q.landmark === 'pier')
  return q ? placed[q.id] : undefined
}
