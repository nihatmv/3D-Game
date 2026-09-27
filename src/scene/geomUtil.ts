import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Helpers for building low-poly props from primitives: each part gets a
 * transform and a flat vertex colour, then everything is merged into one
 * geometry (so each prop kind is a single instanced draw call).
 */

export type Part = {
  geo: BufferGeometry
  /** Flat colour for the part; omit to keep the geometry's own `color` attribute. */
  color?: string
  pos?: [number, number, number]
  rot?: [number, number, number]
  scale?: [number, number, number]
}

const m = new Matrix4()
const q = new Quaternion()

export function build(parts: Part[]): BufferGeometry {
  const geos = parts.map(({ geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] }) => {
    const g = geo.index ? geo.toNonIndexed() : geo
    if (g.getAttribute('uv')) g.deleteAttribute('uv')
    if (g.getAttribute('normal')) g.deleteAttribute('normal')
    q.setFromEuler(new Euler(...rot))
    g.applyMatrix4(m.compose(new Vector3(...pos), q, new Vector3(...scale)))
    if (color !== undefined || !g.getAttribute('color')) {
      const c = new Color(color ?? '#ffffff')
      const cols = new Float32Array(g.getAttribute('position').count * 3)
      for (let i = 0; i < cols.length; i += 3) {
        cols[i] = c.r
        cols[i + 1] = c.g
        cols[i + 2] = c.b
      }
      g.setAttribute('color', new BufferAttribute(cols, 3))
    }
    return g
  })
  const merged = mergeGeometries(geos)!
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  geos.forEach((g) => g.dispose())
  return merged
}

/** Small deterministic PRNG so every model is the same on each load. */
export function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}
