import { BEVEL, GRID, SEA_Y, STEP, TILE_COUNT, TileType, surfaceY, topY } from './constants'
import { N4, idx, inBounds } from './grid'

/**
 * Water surface height for every pond tile (NaN where there is no water).
 *
 * Connected water tiles form one pond sharing a single level: a bit above the
 * highest pond's nominal level, but never above the lowest bank, so water never
 * spills over. Pond beds are sunken (see POND_DEPTH), so even a bank at the same
 * level holds shallow water. Ponds open to the ocean become part of the sea
 * (NaN here), so the ocean surface itself shows in them.
 */
export function computePondLevels(height: Uint8Array, type: Uint8Array, out: Float32Array): void {
  out.fill(NaN)
  const seen = new Uint8Array(TILE_COUNT)
  const members: number[] = []
  const queue: number[] = []
  const isPond = (i: number) => type[i] === TileType.Water && height[i] > 0

  for (let start = 0; start < TILE_COUNT; start++) {
    if (seen[start] || !isPond(start)) continue

    members.length = 0
    queue.length = 0
    queue.push(start)
    seen[start] = 1
    let maxNominal = -Infinity
    let rim = Infinity

    while (queue.length) {
      const i = queue.pop()!
      members.push(i)
      const x = i % GRID
      const z = (i / GRID) | 0
      const bed = surfaceY(height[i], type[i])
      maxNominal = Math.max(maxNominal, topY(height[i]))
      for (const [dx, dz] of N4) {
        const nx = x + dx
        const nz = z + dz
        const n = inBounds(nx, nz) ? idx(nx, nz) : -1
        if (n >= 0 && isPond(n)) {
          if (!seen[n]) {
            seen[n] = 1
            queue.push(n)
          }
          continue
        }
        let bank: number
        if (n < 0 || height[n] === 0) {
          bank = SEA_Y
        } else {
          const ny = surfaceY(height[n], type[n])
          // A higher bank's wall starts one bevel below its top.
          bank = ny > bed ? ny - BEVEL - 0.03 : ny
        }
        rim = Math.min(rim, bank)
      }
    }

    const level = Math.min(maxNominal + STEP * 0.6, rim)
    // A pond open to the sea is just sea: the ocean surface shows there instead.
    if (level <= SEA_Y + 0.02) continue
    for (const m of members) {
      if (level > surfaceY(height[m], type[m]) + 0.03) out[m] = level
    }
  }
}
