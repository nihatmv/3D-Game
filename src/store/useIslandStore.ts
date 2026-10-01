import { create } from 'zustand'
import { HALF, MAX_LEVEL, MAX_STONE, TILE_COUNT, TileType } from '../world/constants'
import { N8, hash2, idx, inBounds, initialIsland } from '../world/grid'
import { computePondLevels } from '../world/ponds'
import { computeTerrainField, type TerrainField } from '../world/terrainField'
import { MAX_PLANTS, isTree, plantRules, type PlantKind } from '../world/plantRules'
import { DECOR_PLANTS, DECOR_STONES } from '../world/decor'

export type Tool = 'soil' | 'stone' | 'water' | 'seeds'
export type TileCoord = { x: number; z: number }

export type Plant = {
  id: number
  /** Tile index the plant grows on. */
  tile: number
  /** Offset from the tile centre (world units). */
  ox: number
  oz: number
  kind: PlantKind
  /** performance.now() timestamp when the seed landed. */
  plantedAt: number
  scale: number
  rot: number
}

type IslandState = {
  /** Height level per tile (0 = ocean). Mutated in place; watch terrainVersion. */
  height: Uint8Array
  /** TileType per tile. Mutated in place; watch terrainVersion. */
  type: Uint8Array
  /** Pond water surface y per tile, NaN where dry. Derived from height/type. */
  pondLevel: Float32Array
  /** Smooth terrain layers derived from height/type (shape, ground height queries). */
  field: TerrainField
  terrainVersion: number
  /** Stone pieces stacked on each tile (0..MAX_STONE). Watch stoneVersion. */
  stones: Uint8Array
  stoneVersion: number
  /** 1 where a landmark stands: no tool can change these tiles. */
  locked: Uint8Array

  tool: Tool
  /** Touch "remove" toggle: tools do their Shift action (phones have no Shift key). */
  erase: boolean
  hover: TileCoord | null

  setTool: (tool: Tool) => void
  setErase: (erase: boolean) => void
  setHover: (hover: TileCoord | null) => void

  /** Soil: add one level (or turn ocean into a new beach). */
  raise: (x: number, z: number) => boolean
  /** Soil + shift: remove one level; level 0 becomes ocean. */
  lower: (x: number, z: number) => boolean
  /** Water: dig the tile down one level and flood it. */
  dig: (x: number, z: number) => boolean
  /** Water + shift: fill a pond tile back in with grass. */
  fill: (x: number, z: number) => boolean
  /** Stone: place a boulder, or stack another block on top. */
  addStone: (x: number, z: number) => boolean
  /** Stone + shift: remove the top piece. */
  removeStone: (x: number, z: number) => boolean

  /** All plants. Mutated in place; watch plantVersion. */
  plants: Plant[]
  plantVersion: number
  /** Seeds: scatter `count` seeds around a world-space point. Returns how many took root. */
  scatterSeeds: (wx: number, wz: number, count: number, radius: number) => number
  /** Seeds + shift: clear every plant on a tile. */
  removePlants: (x: number, z: number) => boolean

  /** A landmark takes these tiles: optionally clear stones/plants, and lock `lock` against edits. */
  claimTiles: (clear: number[], lock: number[], what: { stones?: boolean; plants?: boolean }) => void
}

const initial = initialIsland()
const initialStones = new Uint8Array(TILE_COUNT)
for (const d of DECOR_STONES) {
  const i = idx(d.x, d.z)
  initialStones[i] = d.n
  initial.type[i] = TileType.Stone
}
const initialPonds = new Float32Array(TILE_COUNT)
computePondLevels(initial.height, initial.type, initialPonds)

/** Decoration plants start fully grown (planted long ago), so nothing animates on load. */
const initialPlants: Plant[] = DECOR_PLANTS.map((d, k) => ({
  id: k + 1,
  tile: idx(d.x, d.z),
  ox: (hash2(d.x, d.z) - 0.5) * (isTree(d.kind) ? 0.2 : 0.5),
  oz: (hash2(d.z, d.x) - 0.5) * (isTree(d.kind) ? 0.2 : 0.5),
  kind: d.kind,
  plantedAt: -1e9,
  scale: 0.85 + hash2(k, 3) * 0.3,
  rot: hash2(k, 5) * Math.PI * 2,
}))

export const useIslandStore = create<IslandState>((set, get) => {
  /** Recompute derived data and notify subscribers after a terrain edit. */
  const commitTerrain = () => {
    const { height, type, pondLevel, terrainVersion } = get()
    computePondLevels(height, type, pondLevel)
    set({ field: computeTerrainField(height, type), terrainVersion: terrainVersion + 1 })
  }

  const commitStones = () => set({ stoneVersion: get().stoneVersion + 1 })

  const commitPlants = () => set({ plantVersion: get().plantVersion + 1 })
  let nextPlantId = initialPlants.length + 1

  /** Remove every plant on a tile. Returns true if any were removed. */
  const clearPlants = (i: number) => {
    const { plants } = get()
    const before = plants.length
    let w = 0
    for (let r = 0; r < plants.length; r++) if (plants[r].tile !== i) plants[w++] = plants[r]
    plants.length = w
    if (w === before) return false
    commitPlants()
    return true
  }

  /** Drop every stone on a tile (it was dug out or sank into the ocean). */
  const clearStones = (i: number) => {
    const { stones } = get()
    if (stones[i] === 0) return
    stones[i] = 0
    commitStones()
  }

  return {
    ...initial,
    pondLevel: initialPonds,
    field: computeTerrainField(initial.height, initial.type),
    terrainVersion: 0,
    stones: initialStones,
    stoneVersion: 0,
    locked: new Uint8Array(TILE_COUNT),

    tool: 'soil',
    erase: false,
    hover: null,

    setTool: (tool) => set({ tool }),
    setErase: (erase) => set({ erase }),
    setHover: (hover) => {
      const cur = get().hover
      if (cur === hover || (cur && hover && cur.x === hover.x && cur.z === hover.z)) return
      set({ hover })
    },

    raise: (x, z) => {
      if (get().locked[idx(x, z)]) return false
      const { height, type, stones } = get()
      const i = idx(x, z)
      if (type[i] === TileType.Water) {
        // Filling a pond comes first: keep the level, turn it into soil.
        type[i] = TileType.Soil
      } else if (height[i] < MAX_LEVEL) {
        height[i]++
        // Stones ride up with the land; bare tiles become fresh soil.
        if (stones[i] === 0) type[i] = TileType.Soil
      } else {
        return false
      }
      commitTerrain()
      return true
    },

    lower: (x, z) => {
      if (get().locked[idx(x, z)]) return false
      const { height, type } = get()
      const i = idx(x, z)
      if (height[i] === 0) return false
      height[i]--
      if (height[i] === 0) {
        type[i] = TileType.Grass
        clearStones(i)
        clearPlants(i)
      }
      commitTerrain()
      return true
    },

    dig: (x, z) => {
      if (get().locked[idx(x, z)]) return false
      const { height, type } = get()
      const i = idx(x, z)
      const h = height[i]
      if (h === 0) return false
      if (type[i] === TileType.Water) {
        // Deepen an existing pond, but keep a bed above the seabed.
        if (h <= 1) return false
        height[i]--
      } else if (h === 1) {
        // Digging a beach tile opens a channel to the ocean.
        height[i] = 0
        type[i] = TileType.Grass
      } else {
        height[i]--
        type[i] = TileType.Water
      }
      clearStones(i)
      clearPlants(i)
      commitTerrain()
      return true
    },

    fill: (x, z) => {
      if (get().locked[idx(x, z)]) return false
      const { height, type } = get()
      const i = idx(x, z)
      if (type[i] !== TileType.Water) return false
      type[i] = TileType.Grass
      height[i] = Math.min(MAX_LEVEL, height[i] + 1)
      commitTerrain()
      return true
    },

    addStone: (x, z) => {
      if (get().locked[idx(x, z)]) return false
      const { height, type, stones } = get()
      const i = idx(x, z)
      if (height[i] === 0 || type[i] === TileType.Water || stones[i] >= MAX_STONE) return false
      stones[i]++
      clearPlants(i)
      commitStones()
      if (type[i] !== TileType.Stone) {
        type[i] = TileType.Stone
        commitTerrain()
      }
      return true
    },

    removeStone: (x, z) => {
      if (get().locked[idx(x, z)]) return false
      const { type, stones } = get()
      const i = idx(x, z)
      if (stones[i] === 0) return false
      stones[i]--
      commitStones()
      if (stones[i] === 0) {
        type[i] = TileType.Grass
        commitTerrain()
      }
      return true
    },

    plants: initialPlants,
    plantVersion: 0,

    scatterSeeds: (wx, wz, count, radius) => {
      const { height, type, stones, pondLevel, plants, locked } = get()
      const now = performance.now()
      let grown = 0
      for (let n = 0; n < count && plants.length < MAX_PLANTS; n++) {
        // Uniform point in a disc around the click.
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * radius
        const px = wx + Math.cos(a) * r
        const pz = wz + Math.sin(a) * r
        const x = Math.floor(px + HALF)
        const z = Math.floor(pz + HALF)
        if (!inBounds(x, z)) continue
        const i = idx(x, z)
        if (locked[i]) continue

        let nearWater = false
        for (const [dx, dz] of N8) {
          const nx = x + dx
          const nz = z + dz
          const n = inBounds(nx, nz) ? idx(nx, nz) : -1
          if (n < 0 || height[n] === 0 || type[n] === TileType.Water || !Number.isNaN(pondLevel[n])) {
            nearWater = true
            break
          }
        }
        let plantsOnTile = 0
        let hasTree = false
        for (const p of plants) {
          if (p.tile !== i) continue
          plantsOnTile++
          if (isTree(p.kind)) hasTree = true
        }

        const kind = plantRules(
          { level: height[i], type: type[i], stones: stones[i], nearWater, plantsOnTile, hasTree },
          Math.random,
        )
        if (!kind) continue

        // Trees stand near the tile centre so their canopies don't clip walls.
        const lim = isTree(kind) ? 0.12 : 0.36
        const cx = x - HALF + 0.5
        const cz = z - HALF + 0.5
        plants.push({
          id: nextPlantId++,
          tile: i,
          ox: Math.max(-lim, Math.min(lim, px - cx)),
          oz: Math.max(-lim, Math.min(lim, pz - cz)),
          kind,
          plantedAt: now + Math.random() * 400,
          scale: 0.8 + Math.random() * 0.35,
          rot: Math.random() * Math.PI * 2,
        })
        grown++
      }
      if (grown) commitPlants()
      return grown
    },

    removePlants: (x, z) => !get().locked[idx(x, z)] && clearPlants(idx(x, z)),

    claimTiles: (clear, lock, what) => {
      const { stones, type, locked } = get()
      let terrain = false
      for (const i of clear) {
        if (what.plants) clearPlants(i)
        if (what.stones && stones[i] > 0) {
          clearStones(i)
          if (type[i] === TileType.Stone) {
            type[i] = TileType.Grass
            terrain = true
          }
        }
      }
      for (const i of lock) locked[i] = 1
      if (terrain) commitTerrain()
    },
  }
})

// Dev-only handle for debugging from the browser console.
if (import.meta.env.DEV) (window as unknown as { island: typeof useIslandStore }).island = useIslandStore
