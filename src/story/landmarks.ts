import { useIslandStore } from '../store/useIslandStore'
import { GRID, HALF, SEA_Y, TileType, surfaceY, topY } from '../world/constants'
import { DECOR_CABIN, DECOR_FALLS, HIGHLAND, HIGHLAND_X, HIGHLAND_Z } from '../world/decor'
import { N8, idx, inBounds } from '../world/grid'
import { isTree } from '../world/plantRules'
import { tilesInArea, type Quest } from './quests'

/** Where a landmark stands: its anchor tile and world-space origin. */
export type Placement = { tile: number; x: number; y: number; z: number }

/** Tiles of open ocean the pier reaches over, beyond its anchor. */
export const PIER_TILES = 3

/** Rows of sea north of the pier row kept open for the ship: two under the hull, one to spare. */
const HARBOUR_NORTH = 3

/** Which way along x the pier reaches: -1 = west, toward where the ship waits (top-left of the default view). */
export const PIER_DIR = -1

/** Height level of a highland tile (decor.ts). */
const highlandLevel = (x: number, z: number) => Number(HIGHLAND[z - HIGHLAND_Z][x - HIGHLAND_X])

/** How far the falls drop, from the lip to the plunge pool's level. */
export const FALLS_DROP = topY(highlandLevel(DECOR_FALLS.x, DECOR_FALLS.z)) - topY(2)

/** Bank tiles (offsets from the pond quest's centre) where the lake bridge lands, across the lake's narrow middle. */
export const POND_BRIDGE_ENDS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 2],
]

const centreX =(i: number) => (i % GRID) - HALF + 0.5
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

/** The tiles touching `tiles` (corners included). */
function ringAround(tiles: number[]): number[] {
  const ring = new Set<number>()
  for (const i of tiles)
    for (const [dx, dz] of N8) {
      const x = (i % GRID) + dx
      const z = Math.floor(i / GRID) + dz
      if (inBounds(x, z) && !tiles.includes(idx(x, z))) ring.add(idx(x, z))
    }
  return [...ring]
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
export function placeLandmark(q: Quest): Placement {
  const island = useIslandStore.getState()
  const { height, type, stones, plants } = island
  const area = tilesInArea(q.area)
  const { x: ax, z: az } = q.area
  const isLand = (i: number) => height[i] > 0 && type[i] !== TileType.Water && !island.locked[i]
  const land = area.filter(isLand)
  const fallback = idx(ax, az)

  switch (q.landmark) {
    case 'lighthouse': {
      const tile = pick(land, ax, az, (i) => stones[i]) ?? fallback
      island.claimTiles(area, [tile], { stones: true })
      island.claimTiles([tile], [], { plants: true })
      // Lock the ground around it too, so the tower keeps a patch of island to stand on.
      island.claimTiles([], ringAround([tile]), {})
      return { tile, x: centreX(tile), y: groundY(tile), z: centreZ(tile) }
    }

    case 'pondRipples': {
      // The lake is the quest's click shape: dig whatever is still dry (skipped or cut short).
      const lake = q.clicks.map(([dx, dz]) => [ax + dx, az + dz] as const)
      for (const [x, z] of lake) if (type[idx(x, z)] !== TileType.Water) island.dig(x, z)
      let water = lake.map(([x, z]) => idx(x, z)).filter((i) => type[i] === TileType.Water)
      if (water.length === 0) water = [fallback]
      // The bridge's two ends stand on the bank, so lock those too.
      const ends = POND_BRIDGE_ENDS.map(([dx, dz]) => idx(ax + dx, az + dz))
      island.claimTiles([...water, ...ends], [...water, ...ends], { stones: true, plants: true })
      // Lock the banks as well: washing them away would drain the lake and leave its bridge, pads and reeds in the air.
      // Diagonal ones too, or the square water tiles poke out past the rounded corner the bank leaves behind.
      island.claimTiles([], ringAround(water), {})
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
      // Lock the harbour too: the water the ship lies in (north of the deck, see ALONGSIDE in shipPath.ts) with a row
      // to spare on each side, out to the edge of the map, so it can't be filled in or walled off from the sea.
      const harbour: number[] = []
      for (let z = az - HARBOUR_NORTH; z <= az + 1; z++)
        for (let x = ex + PIER_DIR; x >= 0 && x < GRID; x += PIER_DIR) if (inBounds(x, z)) harbour.push(idx(x, z))
      island.claimTiles([], harbour, {})
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
      // The grove (landmarkGeometry) spreads over the land tiles around it.
      const tx = tile % GRID
      const tz = Math.floor(tile / GRID)
      const grove = [tile]
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = tx + dx
          const z = tz + dz
          if ((dx || dz) && x >= 0 && x < GRID && z >= 0 && z < GRID && isLand(idx(x, z))) grove.push(idx(x, z))
        }
      island.claimTiles(grove, grove, { stones: true, plants: true })
      // The rest of the forest (the decoration trees) grows with it.
      island.growForest()
      return { tile, x: centreX(tile), y: groundY(tile), z: centreZ(tile) }
    }

    // Scenery stops: the cabin and the falls draw themselves (Cabin, Waterfall) on
    // locked highland tiles, so there is nothing to claim, only a spot to fly to.
    case 'cabin': {
      const { x, z } = DECOR_CABIN
      return { tile: fallback, x: x - HALF + 0.5, y: topY(highlandLevel(Math.floor(x), Math.floor(z))), z: z - HALF + 0.5 }
    }

    case 'falls': {
      const { x, z, width } = DECOR_FALLS
      const pool = useIslandStore.getState().pondLevel[idx(x + 1, z + 1)]
      // The foot of the falls: the middle of the lip, at the pool's surface.
      return { tile: fallback, x: x + width / 2 - HALF, y: Number.isNaN(pool) ? topY(2) : pool, z: z + 1 - HALF }
    }
  }
}

/** Where the pier stands, if its quest is built (quests are data, so look it up by landmark kind). */
export function findPier(placed: Record<string, Placement>, quests: Quest[]): Placement | undefined {
  const q = quests.find((q) => q.landmark === 'pier')
  return q ? placed[q.id] : undefined
}
