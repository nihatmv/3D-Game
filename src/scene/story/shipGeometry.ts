import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { build, type Part } from '../geomUtil'

const HULL = '#33231b'
const HULL_DARK = '#2a1c15'
const WALE = '#8e2f26'
const GOLD = '#d9a441'
const DECK = '#a97b52'
const SAIL = '#36302e'
const BONE = '#f1e8d6'
const SOCKET = '#1c1716'
const IRON = '#232323'
const LAMP = '#ffd27a'
const ROPE = '#2b211b'

/**
 * Hull seen from above (bow toward +x), extruded upward. The bottom ring is
 * pulled in so the hull tapers like a real boat.
 */
function hull(length: number, beam: number, height: number, taper: number, zTaper = taper * 0.8): BufferGeometry {
  const L = length / 2
  const B = beam / 2
  const s = new Shape()
  s.moveTo(-L, -B * 0.8)
  s.quadraticCurveTo(-L - 0.12, 0, -L, B * 0.8)
  s.lineTo(L * 0.35, B)
  s.quadraticCurveTo(L * 0.85, B * 0.8, L, 0)
  s.quadraticCurveTo(L * 0.85, -B * 0.8, L * 0.35, -B)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 5 })
  // Extruded along +z: stand it up so the extrusion becomes +y.
  g.rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 1e-3) {
      pos.setX(i, pos.getX(i) * taper)
      pos.setZ(i, pos.getZ(i) * zTaper)
    }
  }
  return g
}

/**
 * A square sail facing along x, bellied forward by `belly`.
 * `tattered` notches the bottom edge so it looks weathered.
 */
function sail(height: number, width: number, belly: number, tattered = false): BufferGeometry {
  const segs = 6
  const g = new BoxGeometry(0.04, height, width, 1, 3, segs)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const yn = y / (height / 2)
    const zn = z / (width / 2)
    pos.setX(i, pos.getX(i) + belly * (1 - zn * zn) * (1 - 0.5 * yn * yn))
    if (tattered && yn < -0.99 && Math.round((zn * 0.5 + 0.5) * segs) % 2 === 1) pos.setY(i, y + 0.08)
  }
  return g
}

/** A thin cylinder stretched from a to b, already placed in ship space. */
function rope(a: [number, number, number], b: [number, number, number], r = 0.012): Part {
  const from = new Vector3(...a)
  const dir = new Vector3(...b).sub(from)
  const g = new CylinderGeometry(r, r, dir.length(), 3)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize()))
  g.translate(from.x + dir.x / 2, from.y + dir.y / 2, from.z + dir.z / 2)
  return { geo: g, color: ROPE }
}

/**
 * Skull and crossbones on a plane facing `axis` ('x' for sails, 'z' for the flag),
 * centred at `c`, `s` units tall. `depth` is how far it pokes out each face.
 */
function jollyRoger(c: [number, number, number], s: number, axis: 'x' | 'z', depth: number): Part[] {
  const [cx, cy, cz] = c
  // Work in a local (u = across, v = up, w = through) frame, then map to ship space.
  const at = (u: number, v: number, w = 0): [number, number, number] =>
    axis === 'x' ? [cx + w, cy + v, cz + u] : [cx + u, cy + v, cz + w]
  const thick = (k: number): [number, number, number] => (axis === 'x' ? [k, 1, 1] : [1, 1, k])
  const tilt = (a: number): [number, number, number] => (axis === 'x' ? [a, 0, 0] : [0, 0, a])
  const r = s * 0.3
  // Which way a bone's end swings in u when tilted (rotation about x vs about z).
  const swing = axis === 'x' ? 1 : -1
  const parts: Part[] = []
  // Crossbones behind the skull, with knobbly ends.
  for (const a of [0.8, -0.8]) {
    parts.push({ geo: new BoxGeometry(...(axis === 'x' ? [depth * 1.6, s * 0.95, s * 0.09] : [s * 0.09, s * 0.95, depth * 1.6]) as [number, number, number]), color: BONE, pos: at(0, -s * 0.05), rot: tilt(a) })
    for (const end of [1, -1]) {
      const l = s * 0.48 * end
      parts.push({ geo: new SphereGeometry(s * 0.08, 5, 4), color: BONE, pos: at(swing * l * Math.sin(a), -s * 0.05 + l * Math.cos(a)), scale: thick(depth * 1.6 / (s * 0.16)) })
    }
  }
  // Cranium, jaw, eye sockets and nose.
  parts.push({ geo: new SphereGeometry(r, 8, 6), color: BONE, pos: at(0, s * 0.08), scale: thick((depth * 2) / (r * 2)) })
  parts.push({ geo: new BoxGeometry(...(axis === 'x' ? [depth * 2, s * 0.16, r * 1.1] : [r * 1.1, s * 0.16, depth * 2]) as [number, number, number]), color: BONE, pos: at(0, -s * 0.16) })
  for (const side of [1, -1]) {
    parts.push({ geo: new SphereGeometry(r * 0.3, 5, 4), color: SOCKET, pos: at(side * r * 0.42, s * 0.06), scale: thick((depth * 2.3) / (r * 0.6)) })
  }
  parts.push({ geo: new ConeGeometry(r * 0.14, r * 0.3, 3), color: SOCKET, pos: at(0, -s * 0.06), rot: [Math.PI, 0, 0], scale: thick((depth * 2.3) / (r * 0.28)) })
  return parts
}

/** How far the yards are swung off square, so the sails face the camera instead of showing their edge. */
const BRACE = 0.55

/** Merge a mast's yards and sails (built around x = 0) and swing them about the mast at `x`. */
function braced(x: number, angle: number, parts: Part[]): Part {
  return { geo: build(parts).rotateY(angle).translate(x, 0, 0) }
}

/** A two-masted pirate ship, about 3 units long, merged into one geometry. */
export function makeShipGeometry(): BufferGeometry {
  const parts: Part[] = [
    // Hull: dark planks, a red wale along the gun deck, a gold stripe under the rail.
    { geo: hull(3, 1.1, 0.55, 0.72), color: HULL, pos: [0, -0.3, 0] },
    { geo: hull(2.99, 1.12, 0.12, 0.936, 0.903), color: WALE, pos: [0, 0.08, 0] },
    { geo: hull(3.05, 1.16, 0.08, 1), color: HULL_DARK, pos: [0, 0.22, 0] },
    { geo: hull(3.08, 1.19, 0.025, 1), color: GOLD, pos: [0, 0.2, 0] },
    { geo: hull(2.8, 0.98, 0.04, 1), color: DECK, pos: [0, 0.27, 0] },

    // Sterncastle: raised quarterdeck with a gold stripe, lit stern windows and lanterns.
    { geo: new BoxGeometry(0.7, 0.34, 0.78), color: HULL_DARK, pos: [-1.1, 0.45, 0] },
    { geo: new BoxGeometry(0.76, 0.05, 0.84), color: HULL_DARK, pos: [-1.1, 0.64, 0] },
    { geo: new BoxGeometry(0.73, 0.025, 0.81), color: GOLD, pos: [-1.1, 0.6, 0] },
    ...[-0.22, 0, 0.22].map((z): Part => ({ geo: new BoxGeometry(0.03, 0.12, 0.12), color: LAMP, pos: [-1.46, 0.46, z] })),
    ...[-0.36, 0.36].flatMap((z): Part[] => [
      { geo: new CylinderGeometry(0.012, 0.012, 0.2, 4), color: IRON, pos: [-1.42, 0.76, z] },
      { geo: new BoxGeometry(0.08, 0.1, 0.08), color: LAMP, pos: [-1.42, 0.9, z] },
      { geo: new ConeGeometry(0.06, 0.06, 4), color: IRON, pos: [-1.42, 0.98, z], rot: [0, Math.PI / 4, 0] },
    ]),
    // Ship's wheel.
    { geo: new CylinderGeometry(0.02, 0.025, 0.2, 4), color: HULL_DARK, pos: [-0.86, 0.76, 0] },
    { geo: new TorusGeometry(0.1, 0.015, 3, 8), color: GOLD, pos: [-0.83, 0.86, 0], rot: [0, Math.PI / 2, 0] },

    // Cannons poking out of gunports on both sides.
    ...[
      [-0.45, 0.455],
      [0.05, 0.48],
      [0.5, 0.5],
    ].flatMap(([x, z]) =>
      [1, -1].flatMap((side): Part[] => [
        { geo: new BoxGeometry(0.15, 0.12, 0.04), color: SOCKET, pos: [x, 0.14, side * (z + 0.02)] },
        { geo: new CylinderGeometry(0.035, 0.045, 0.22, 6), color: IRON, pos: [x, 0.14, side * (z + 0.06)], rot: [Math.PI / 2, 0, 0] },
      ]),
    ),

    // Deck clutter: a treasure chest and barrels.
    { geo: new BoxGeometry(0.22, 0.13, 0.15), color: HULL_DARK, pos: [0.55, 0.36, 0.22] },
    { geo: new CylinderGeometry(0.075, 0.075, 0.22, 6, 1, false, 0, Math.PI), color: GOLD, pos: [0.55, 0.43, 0.22], rot: [0, 0, Math.PI / 2] },
    { geo: new CylinderGeometry(0.07, 0.07, 0.16, 7), color: HULL, pos: [-0.5, 0.37, -0.25] },
    { geo: new CylinderGeometry(0.07, 0.07, 0.16, 7), color: HULL, pos: [-0.36, 0.37, -0.3] },

    // Bowsprit with a gold figurehead underneath.
    { geo: new CylinderGeometry(0.03, 0.045, 0.9, 5), color: HULL_DARK, pos: [1.65, 0.42, 0], rot: [0, 0, -1.2] },
    { geo: new ConeGeometry(0.07, 0.3, 5), color: GOLD, pos: [1.58, 0.14, 0], rot: [0, 0, -1.9] },

    // Main mast with yards, crow's nest and topsail.
    { geo: new CylinderGeometry(0.045, 0.065, 2.8, 6), color: HULL_DARK, pos: [0.05, 1.6, 0] },
    braced(0.05, BRACE, [
      { geo: new CylinderGeometry(0.025, 0.025, 1.45, 4), color: HULL_DARK, pos: [0.03, 2.02, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: new CylinderGeometry(0.025, 0.025, 1.35, 4), color: HULL_DARK, pos: [0.03, 0.9, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: sail(1.1, 1.35, 0.14, true), color: SAIL, pos: [0.05, 1.45, 0] },
      ...jollyRoger([0.19, 1.47, 0], 0.62, 'x', 0.06),
      { geo: new CylinderGeometry(0.02, 0.02, 1.0, 4), color: HULL_DARK, pos: [0.02, 2.7, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: sail(0.45, 0.95, 0.09), color: SAIL, pos: [0.03, 2.47, 0] },
    ]),
    { geo: new CylinderGeometry(0.17, 0.13, 0.13, 8), color: HULL_DARK, pos: [0.05, 2.15, 0] },

    // Foremast.
    { geo: new CylinderGeometry(0.035, 0.05, 1.7, 6), color: HULL_DARK, pos: [0.85, 1.1, 0] },
    braced(0.85, BRACE, [
      { geo: new CylinderGeometry(0.02, 0.02, 1.05, 4), color: HULL_DARK, pos: [0.03, 1.6, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: sail(0.8, 0.95, 0.1, true), color: SAIL, pos: [0.05, 1.18, 0] },
    ]),

    // Jib: a triangle from the foremast to the bowsprit.
    { geo: new ConeGeometry(0.42, 0.95, 3), color: SAIL, pos: [1.38, 0.95, 0], rot: [0, Math.PI / 2, 0], scale: [1, 1, 0.12] },

    // Rigging: stays fore and aft, shrouds down to the rails.
    rope([0.05, 2.95, 0], [2.07, 0.58, 0]),
    rope([0.05, 2.95, 0], [-1.42, 0.66, 0]),
    rope([0.85, 1.93, 0], [2.07, 0.58, 0]),
    ...[-0.2, 0.0, 0.2].flatMap((dx) => [1, -1].map((side) => rope([0.05, 2.1, 0], [0.05 + dx, 0.28, side * 0.5]))),

    // Jolly Roger at the masthead, streaming aft.
    { geo: new BoxGeometry(0.56, 0.36, 0.025), color: SOCKET, pos: [-0.25, 2.82, 0] },
    ...jollyRoger([-0.27, 2.82, 0], 0.3, 'z', 0.025),
  ]
  return build(parts)
}
