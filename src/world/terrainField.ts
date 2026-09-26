import { BEVEL, GRID, HALF, SEABED_Y, TILE_COUNT, surfaceY } from './constants'
import { hash2 } from './grid'

/**
 * Smooth terrain layers.
 *
 * The island is a stack of layers, one per distinct surface height (terrace
 * levels and sunken pond beds). Each layer's outline comes from a smoothed
 * field: "is this tile at least this high?" blurred with a Gaussian and read
 * at 0.5. Straight edges stay on tile borders; corners and diagonal staircases
 * become curves. Layers are nested (higher layers lie inside lower ones), so
 * cliffs and terraces fall out naturally.
 *
 * Fields are sampled on a fine grid: RES samples per tile, with PAD tiles of
 * margin around the island grid.
 */

export const RES = 4
export const PAD = 2
/** Samples per axis. */
export const NS = (GRID + PAD * 2) * RES
/** World x/z of the sample grid's outer edge (sample 0 sits half a step inside). */
export const ORIGIN = -HALF - PAD
/** World units covered by the sample grid. */
export const EXTENT = NS / RES

/** Blur radius in tiles: higher = rounder corners, but small features shrink. */
const SIGMA = 0.34
/** Kernel reach in tiles. */
const KR = 2
/** Gentle wobble so coastlines don't look machine-made. */
const NOISE_AMP = 0.05
/** Field range over which the edge bevel eases in (≈ one fine cell). */
const BEVEL_F = 0.16

export const sampleCoord = (u: number) => ORIGIN + (u + 0.5) / RES

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const s = Math.sign(x)
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}
const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))

/**
 * W[sub][k]: how much the tile at offset (k - KR) covers a sample at sub-cell
 * position `sub`, i.e. the integral of the Gaussian over that tile. Separable,
 * and all weights across a row sum to 1, so a fully-inside sample reads 1.
 */
const W: Float64Array[] = Array.from({ length: RES }, (_, sub) => {
  const d = (sub + 0.5) / RES - 0.5
  const w = new Float64Array(KR * 2 + 1)
  for (let k = 0; k <= KR * 2; k++) {
    const dx = k - KR
    w[k] = Phi((d - dx + 0.5) / SIGMA) - Phi((d - dx - 0.5) / SIGMA)
  }
  return w
})

/** Smooth value noise per sample, shared by all layers so nested contours stay nested. */
const NOISE = (() => {
  const n = new Float32Array(NS * NS)
  const scale = 1.4 // tiles per noise cell
  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (let v = 0; v < NS; v++) {
    for (let u = 0; u < NS; u++) {
      const x = sampleCoord(u) / scale
      const z = sampleCoord(v) / scale
      const x0 = Math.floor(x)
      const z0 = Math.floor(z)
      const fx = smooth(x - x0)
      const fz = smooth(z - z0)
      const h = (i: number, j: number) => hash2(i * 3 + 101, j * 5 + 7) * 2 - 1
      const top = h(x0, z0) + (h(x0 + 1, z0) - h(x0, z0)) * fx
      const bot = h(x0, z0 + 1) + (h(x0 + 1, z0 + 1) - h(x0, z0 + 1)) * fx
      n[v * NS + u] = (top + (bot - top) * fz) * NOISE_AMP
    }
  }
  return n
})()

export type TerrainField = {
  /** Ascending surface heights, one per layer. */
  values: number[]
  /** Smoothed membership field per layer (NS*NS). */
  fields: Float32Array[]
  /** Surface y per tile; -Infinity for ocean. */
  tileSurf: Float32Array
  /** Visible ground height at every sample (SEABED_Y where there is no land). */
  heights: Float32Array
}

/** Edge bevel: how far the surface dips below its layer height near the outline. */
export function bevelDrop(f: number): number {
  const t = Math.min(1, Math.max(0, (f - 0.5) / BEVEL_F))
  return BEVEL * (1 - t * t * (3 - 2 * t))
}

export function computeTerrainField(height: Uint8Array, type: Uint8Array): TerrainField {
  const tileSurf = new Float32Array(TILE_COUNT)
  const set = new Set<number>()
  for (let i = 0; i < TILE_COUNT; i++) {
    tileSurf[i] = height[i] > 0 ? surfaceY(height[i], type[i]) : -Infinity
    if (height[i] > 0) set.add(tileSurf[i])
  }
  const values = [...set].sort((a, b) => a - b)

  const TR = GRID + PAD * 2 // tile rows incl. padding
  const rows = new Float32Array(TR * NS)
  const fields = values.map((v) => {
    // Pass 1: blur along x for every tile row.
    rows.fill(0)
    for (let tr = 0; tr < TR; tr++) {
      const tz = tr - PAD
      if (tz < 0 || tz >= GRID) continue
      for (let u = 0; u < NS; u++) {
        const tcol = Math.floor(u / RES) - PAD
        const w = W[u % RES]
        let s = 0
        for (let k = 0; k <= KR * 2; k++) {
          const tx = tcol + k - KR
          if (tx >= 0 && tx < GRID && tileSurf[tz * GRID + tx] >= v - 1e-6) s += w[k]
        }
        rows[tr * NS + u] = s
      }
    }
    // Pass 2: blur along z, add the shared wobble.
    const f = new Float32Array(NS * NS)
    for (let vv = 0; vv < NS; vv++) {
      const trow = Math.floor(vv / RES)
      const w = W[vv % RES]
      for (let u = 0; u < NS; u++) {
        let s = 0
        for (let k = 0; k <= KR * 2; k++) {
          const tr = trow + k - KR
          if (tr >= 0 && tr < TR) s += rows[tr * NS + u] * w[k]
        }
        // Only wobble near the outline, so interiors stay flat and solid.
        f[vv * NS + u] = s > 0.02 && s < 0.98 ? s + NOISE[vv * NS + u] : s
      }
    }
    return f
  })

  const heights = new Float32Array(NS * NS).fill(SEABED_Y)
  for (let i = 0; i < NS * NS; i++) {
    for (let k = values.length - 1; k >= 0; k--) {
      const f = fields[k][i]
      if (f >= 0.5) {
        heights[i] = values[k] - bevelDrop(f)
        break
      }
    }
  }

  return { values, fields, tileSurf, heights }
}

/** Bilinear read of a per-sample array at a world position. */
export function sampleAt(data: Float32Array, wx: number, wz: number): number {
  const fu = Math.min(NS - 1.001, Math.max(0, (wx - ORIGIN) * RES - 0.5))
  const fv = Math.min(NS - 1.001, Math.max(0, (wz - ORIGIN) * RES - 0.5))
  const u = Math.floor(fu)
  const v = Math.floor(fv)
  const tu = fu - u
  const tv = fv - v
  const i = v * NS + u
  const top = data[i] + (data[i + 1] - data[i]) * tu
  const bot = data[i + NS] + (data[i + NS + 1] - data[i + NS]) * tu
  return top + (bot - top) * tv
}

/** Visible ground height at a world position (matches the rendered mesh). */
export function groundAt(tf: TerrainField, wx: number, wz: number): number {
  for (let k = tf.values.length - 1; k >= 0; k--) {
    const f = sampleAt(tf.fields[k], wx, wz)
    if (f >= 0.5) return tf.values[k] - bevelDrop(f)
  }
  return SEABED_Y
}
