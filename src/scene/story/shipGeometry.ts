import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from 'three'
import { build } from '../geomUtil'

const WOOD = '#8a5a3b'
const WOOD_DARK = '#6e4630'
const TRIM = '#e9d2a6'
const DECK = '#c79a6a'
const SAIL = '#fbf3e4'
const FLAG = '#e9765a'

/**
 * Hull seen from above (bow toward +x), extruded upward. The bottom ring is
 * pulled in so the hull tapers like a real boat.
 */
function hull(length: number, beam: number, height: number, taper: number): BufferGeometry {
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
      pos.setZ(i, pos.getZ(i) * taper * 0.8)
    }
  }
  return g
}

/** A small two-masted sailing ship, about 3 units long, merged into one geometry. */
export function makeShipGeometry(): BufferGeometry {
  return build([
    { geo: hull(3, 1.1, 0.55, 0.72), color: WOOD, pos: [0, -0.3, 0] },
    { geo: hull(3.05, 1.16, 0.08, 1), color: TRIM, pos: [0, 0.22, 0] },
    { geo: hull(2.8, 0.98, 0.04, 1), color: DECK, pos: [0, 0.27, 0] },
    // Stern cabin with a roof.
    { geo: new BoxGeometry(0.62, 0.38, 0.78), color: WOOD_DARK, pos: [-1.0, 0.48, 0] },
    { geo: new BoxGeometry(0.72, 0.06, 0.88), color: TRIM, pos: [-1.0, 0.7, 0] },
    // Masts.
    { geo: new CylinderGeometry(0.045, 0.06, 2.3, 6), color: WOOD_DARK, pos: [0.05, 1.4, 0] },
    { geo: new CylinderGeometry(0.035, 0.05, 1.6, 6), color: WOOD_DARK, pos: [0.85, 1.05, 0] },
    // Bowsprit.
    { geo: new CylinderGeometry(0.03, 0.04, 0.9, 5), color: WOOD_DARK, pos: [1.65, 0.42, 0], rot: [0, 0, -1.2] },
    // Sails: slightly bellied boxes across the deck.
    { geo: new BoxGeometry(0.06, 1.15, 1.25), color: SAIL, pos: [0.12, 1.45, 0], rot: [0, 0, 0.04] },
    { geo: new BoxGeometry(0.06, 0.55, 0.95), color: SAIL, pos: [0.1, 2.25, 0] },
    { geo: new BoxGeometry(0.05, 0.85, 0.9), color: SAIL, pos: [0.9, 1.15, 0], rot: [0, 0, 0.04] },
    // Jib: a triangle from the foremast to the bowsprit.
    { geo: new ConeGeometry(0.42, 0.95, 3), color: SAIL, pos: [1.38, 0.95, 0], rot: [0, Math.PI / 2, 0], scale: [1, 1, 0.12] },
    // Pennant at the top of the main mast.
    { geo: new BoxGeometry(0.42, 0.16, 0.03), color: FLAG, pos: [-0.17, 2.48, 0] },
  ])
}
