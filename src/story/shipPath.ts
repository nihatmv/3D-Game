import { CatmullRomCurve3, Vector3 } from 'three'

/**
 * Where the ship sails, in world space (the island is centred on the origin;
 * the pier quest builds land out toward +x).
 */

/** Offshore, out of the fog, to where it waits for the island to be ready. */
export const ARRIVE_PATH = new CatmullRomCurve3([
  new Vector3(46, 0, -20),
  new Vector3(32, 0, -9),
  new Vector3(21, 0, -1),
  new Vector3(14.5, 0, 1.2),
])

export const ARRIVE_SECONDS = 7

export const WAIT_POINT = ARRIVE_PATH.points[ARRIVE_PATH.points.length - 1]

export const DOCK_SECONDS = 4.5
/**
 * Offset from the pier's centre line to the ship's, so the hull lies alongside.
 * Negative = the far side from the default camera, so the pier stays in view.
 */
const ALONGSIDE = -1.2

/**
 * From wherever the ship is to a berth alongside the end of the pier
 * (`pierX` is where the deck leaves the shore, `length` how far it reaches).
 */
export function dockPath(from: Vector3, pierX: number, pierZ: number, length: number): CatmullRomCurve3 {
  const end = pierX + length
  const z = pierZ + ALONGSIDE
  return new CatmullRomCurve3([from.clone().setY(0), new Vector3(end + 2.4, 0, z - 0.35), new Vector3(end - 0.7, 0, z)])
}
