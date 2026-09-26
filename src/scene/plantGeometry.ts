import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PlantKind } from '../world/plantRules'

/**
 * Low-poly plant models built from primitives, merged into a single
 * vertex-coloured geometry per kind (one draw call per kind). Local y = 0 is
 * the ground; models are roughly tile-scaled (trees ~1.1 tall).
 */

type Part = { geo: BufferGeometry; color: string; pos?: [number, number, number]; rot?: [number, number, number] }

const m = new Matrix4()
const q = new Quaternion()
const one = new Vector3(1, 1, 1)

function build(parts: Part[]): BufferGeometry {
  const geos = parts.map(({ geo, color, pos = [0, 0, 0], rot = [0, 0, 0] }) => {
    const g = geo.index ? geo.toNonIndexed() : geo
    g.deleteAttribute('uv')
    q.setFromEuler(new Euler(...rot))
    g.applyMatrix4(m.compose(new Vector3(...pos), q, one))
    const c = new Color(color)
    const cols = new Float32Array(g.getAttribute('position').count * 3)
    for (let i = 0; i < cols.length; i += 3) {
      cols[i] = c.r
      cols[i + 1] = c.g
      cols[i + 2] = c.b
    }
    g.setAttribute('color', new BufferAttribute(cols, 3))
    return g
  })
  const merged = mergeGeometries(geos)!
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  geos.forEach((g) => g.dispose())
  return merged
}

/** Small deterministic PRNG so every model is the same on each load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

/** A blade: a thin cone standing on the ground, leaning outward. */
function blade(r: () => number, radius: number, h: number, spread: number, colors: string[]): Part {
  const a = r() * Math.PI * 2
  const d = r() * spread
  const lean = 0.15 + r() * 0.3
  return {
    geo: new ConeGeometry(radius, h, 3).translate(0, h / 2, 0),
    color: colors[Math.floor(r() * colors.length)],
    pos: [Math.cos(a) * d, 0, Math.sin(a) * d],
    rot: [Math.sin(a) * lean, 0, -Math.cos(a) * lean],
  }
}

function tuft(): BufferGeometry {
  const r = rng(11)
  const greens = ['#7fbf6a', '#8fcf73', '#a6d98a']
  return build(Array.from({ length: 6 }, () => blade(r, 0.03, 0.18 + r() * 0.12, 0.07, greens)))
}

function bush(): BufferGeometry {
  return build([
    { geo: new IcosahedronGeometry(0.2, 0), color: '#6fae63', pos: [0, 0.17, 0] },
    { geo: new IcosahedronGeometry(0.15, 0), color: '#7dbb6b', pos: [0.15, 0.12, 0.05] },
    { geo: new IcosahedronGeometry(0.13, 0), color: '#69a65c', pos: [-0.12, 0.11, -0.07] },
  ])
}

function flower(): BufferGeometry {
  const r = rng(29)
  const heads = ['#f7a8c4', '#ffe08a', '#fdf6ec']
  const parts: Part[] = []
  heads.forEach((head, k) => {
    const a = (k / heads.length) * Math.PI * 2 + 0.4
    const x = Math.cos(a) * 0.08
    const z = Math.sin(a) * 0.08
    const h = 0.2 + r() * 0.08
    parts.push({ geo: new CylinderGeometry(0.012, 0.014, h, 3).translate(0, h / 2, 0), color: '#7fb865', pos: [x, 0, z] })
    parts.push({ geo: new IcosahedronGeometry(0.055, 0), color: head, pos: [x, h + 0.02, z] })
  })
  const greens = ['#8fcf73', '#7fbf6a']
  for (let i = 0; i < 3; i++) parts.push(blade(r, 0.025, 0.12 + r() * 0.05, 0.06, greens))
  return build(parts)
}

function tree(): BufferGeometry {
  return build([
    { geo: new CylinderGeometry(0.05, 0.08, 0.5, 5).translate(0, 0.25, 0), color: '#9a6b47' },
    { geo: new IcosahedronGeometry(0.34, 0), color: '#7cc36a', pos: [0, 0.74, 0] },
    { geo: new IcosahedronGeometry(0.22, 0), color: '#8ccf73', pos: [0.18, 0.6, 0.1] },
    { geo: new IcosahedronGeometry(0.2, 0), color: '#74b862', pos: [-0.14, 0.94, -0.06] },
  ])
}

function pine(): BufferGeometry {
  return build([
    { geo: new CylinderGeometry(0.05, 0.07, 0.35, 5).translate(0, 0.175, 0), color: '#8f6242' },
    { geo: new ConeGeometry(0.34, 0.5, 6).translate(0, 0.25, 0), color: '#5f9e6e', pos: [0, 0.28, 0] },
    { geo: new ConeGeometry(0.26, 0.42, 6).translate(0, 0.21, 0), color: '#68a876', pos: [0, 0.56, 0] },
    { geo: new ConeGeometry(0.17, 0.34, 6).translate(0, 0.17, 0), color: '#72b27f', pos: [0, 0.82, 0] },
  ])
}

function reed(): BufferGeometry {
  const r = rng(47)
  const greens = ['#a9c96b', '#9dbd5e', '#b5d27a']
  return build(Array.from({ length: 7 }, () => blade(r, 0.02, 0.32 + r() * 0.2, 0.08, greens)))
}

function cattail(): BufferGeometry {
  const r = rng(71)
  const parts: Part[] = []
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + r()
    const x = Math.cos(a) * 0.06
    const z = Math.sin(a) * 0.06
    const h = 0.42 + r() * 0.14
    parts.push({ geo: new CylinderGeometry(0.01, 0.013, h, 3).translate(0, h / 2, 0), color: '#8fb865', pos: [x, 0, z] })
    parts.push({ geo: new CylinderGeometry(0.035, 0.035, 0.12, 5), color: '#8a5a3b', pos: [x, h - 0.06, z] })
  }
  const greens = ['#8fb865', '#a0c572']
  for (let i = 0; i < 4; i++) parts.push(blade(r, 0.02, 0.28 + r() * 0.1, 0.07, greens))
  return build(parts)
}

export function makePlantGeometries(): Record<PlantKind, BufferGeometry> {
  return { tuft: tuft(), bush: bush(), flower: flower(), tree: tree(), pine: pine(), reed: reed(), cattail: cattail() }
}
