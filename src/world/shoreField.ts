import { DataTexture, LinearFilter, RedFormat, UnsignedByteType, ClampToEdgeWrapping } from 'three'
import { GRID, HALF, SEABED_Y } from './constants'
import { sampleAt, type TerrainField } from './terrainField'

/**
 * Distance-to-land field, sampled by the ocean shader for shallow tint and foam.
 * Covers the grid plus a margin; texel value 0 = on land, 1 = MAX_DIST or further.
 */

export const SHORE_MARGIN = 8
export const SHORE_EXTENT = GRID + SHORE_MARGIN * 2 // world units covered
export const SHORE_MIN = -HALF - SHORE_MARGIN // world x/z of texture origin
export const SHORE_MAX_DIST = 6 // world units mapped to 1.0
const RES_PER_UNIT = 4
const RES = SHORE_EXTENT * RES_PER_UNIT

export function createShoreTexture(): DataTexture {
  const tex = new DataTexture(new Uint8Array(RES * RES), RES, RES, RedFormat, UnsignedByteType)
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping
  tex.flipY = false
  tex.needsUpdate = true
  return tex
}

const dist = new Float32Array(RES * RES)
const blur = new Float32Array(RES * RES)

export function updateShoreTexture(tex: DataTexture, field: TerrainField): void {
  const INF = 1e6
  // Seed: 0 on land texels, using the smooth (curved) coastline.
  const landMin = SEABED_Y + 0.05
  const inField = (w: number) => w > -HALF - 2 && w < HALF + 2
  for (let v = 0; v < RES; v++) {
    const wz = SHORE_MIN + (v + 0.5) / RES_PER_UNIT
    for (let u = 0; u < RES; u++) {
      const wx = SHORE_MIN + (u + 0.5) / RES_PER_UNIT
      const land = inField(wx) && inField(wz) && sampleAt(field.heights, wx, wz) > landMin
      dist[v * RES + u] = land ? 0 : INF
    }
  }
  // Two-pass chamfer distance transform (weights 1 / sqrt2), in texels.
  const D = Math.SQRT2
  for (let v = 0; v < RES; v++) {
    for (let u = 0; u < RES; u++) {
      const i = v * RES + u
      let d = dist[i]
      if (u > 0) d = Math.min(d, dist[i - 1] + 1)
      if (v > 0) {
        d = Math.min(d, dist[i - RES] + 1)
        if (u > 0) d = Math.min(d, dist[i - RES - 1] + D)
        if (u < RES - 1) d = Math.min(d, dist[i - RES + 1] + D)
      }
      dist[i] = d
    }
  }
  for (let v = RES - 1; v >= 0; v--) {
    for (let u = RES - 1; u >= 0; u--) {
      const i = v * RES + u
      let d = dist[i]
      if (u < RES - 1) d = Math.min(d, dist[i + 1] + 1)
      if (v < RES - 1) {
        d = Math.min(d, dist[i + RES] + 1)
        if (u < RES - 1) d = Math.min(d, dist[i + RES + 1] + D)
        if (u > 0) d = Math.min(d, dist[i + RES - 1] + D)
      }
      dist[i] = d
    }
  }
  // Light 3x3 blur to soften the square tile corners.
  for (let v = 0; v < RES; v++) {
    for (let u = 0; u < RES; u++) {
      let s = 0
      let n = 0
      for (let dv = -1; dv <= 1; dv++) {
        const vv = v + dv
        if (vv < 0 || vv >= RES) continue
        for (let du = -1; du <= 1; du++) {
          const uu = u + du
          if (uu < 0 || uu >= RES) continue
          s += dist[vv * RES + uu]
          n++
        }
      }
      blur[v * RES + u] = s / n
    }
  }
  const data = tex.image.data as Uint8Array
  const scale = 255 / (SHORE_MAX_DIST * RES_PER_UNIT)
  for (let i = 0; i < data.length; i++) data[i] = Math.min(255, blur[i] * scale)
  tex.needsUpdate = true
}
