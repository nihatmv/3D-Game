import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Helpers for building low-poly props from primitives: each part gets a
 * transform and a flat vertex colour, then everything is merged into one
 * geometry (so each prop kind is a single instanced draw call).
 *
 * The merged geometry remembers its parts in `aPart` (per vertex: the part's
 * base centre, and its turn from 0 to 1 when the whole is built bottom-up), so
 * buildMaterial.ts can put it together piece by piece.
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
const v = new Vector3()

/** Give every part its turn: lowest base first, and in the order they were added among equals. */
function orderParts(geo: BufferGeometry) {
  const part = geo.getAttribute('aPart') as BufferAttribute
  const groups = new Map<string, { y: number; first: number; verts: number[] }>()
  for (let i = 0; i < part.count; i++) {
    const key = `${part.getX(i).toFixed(3)},${part.getY(i).toFixed(3)},${part.getZ(i).toFixed(3)}`
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { y: part.getY(i), first: i, verts: [] }))
    g.verts.push(i)
  }
  const sorted = [...groups.values()].sort((a, b) => a.y - b.y || a.first - b.first)
  sorted.forEach((g, rank) => {
    const turn = sorted.length > 1 ? rank / (sorted.length - 1) : 0
    for (const i of g.verts) part.setW(i, turn)
  })
}

export function build(parts: Part[]): BufferGeometry {
  const geos = parts.map(({ geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] }) => {
    const g = geo.index ? geo.toNonIndexed() : geo
    if (g.getAttribute('uv')) g.deleteAttribute('uv')
    if (g.getAttribute('normal')) g.deleteAttribute('normal')
    q.setFromEuler(new Euler(...rot))
    g.applyMatrix4(m.compose(new Vector3(...pos), q, new Vector3(...scale)))
    const count = g.getAttribute('position').count
    const own = g.getAttribute('aPart') as BufferAttribute | undefined
    if (own) {
      // Something built earlier, used as a part: its own parts stay parts, moved along with it.
      for (let i = 0; i < count; i++) {
        v.set(own.getX(i), own.getY(i), own.getZ(i)).applyMatrix4(m)
        own.setXYZ(i, v.x, v.y, v.z)
      }
    } else {
      g.computeBoundingBox()
      const box = g.boundingBox!
      const anchor = new Float32Array(count * 4)
      for (let i = 0; i < count; i++) anchor.set([(box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2, 0], i * 4)
      g.setAttribute('aPart', new BufferAttribute(anchor, 4))
    }
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
  orderParts(merged)
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
