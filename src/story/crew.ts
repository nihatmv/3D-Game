import { useIslandStore } from '../store/useIslandStore'
import { HALF, SEA_Y, TileType } from '../world/constants'
import { idx, inBounds } from '../world/grid'
import { groundAt } from '../world/terrainField'
import { PIER_DIR, type Placement } from './landmarks'

/**
 * The ship's crew: the captain (index 0) and five men who step off at the pier,
 * run to each building site and hammer there (useCrewDirector decides when). Plain mutable state stepped from the scene's frame loop
 * (scene/story/Crew.tsx), so walking costs no React renders. No per-frame work
 * once everyone stands still: `stepCrew` returns false and the scene stops waking.
 */

export type Mate = {
  x: number
  y: number
  z: number
  /** Facing, as a rotation about y (0 = toward +z). */
  heading: number
  /** Waypoints still to walk, in world x/z. */
  path: Array<readonly [number, number]>
  /** Where to look once the path is walked. */
  face: number
  /** Seconds until he sets off (they leave the ship one after another; after a build they cheer first). */
  delay: number
  /** World units per second on the current walk. */
  speed: number
  /** Hammering at the site (the men only; the captain watches). */
  working: boolean
  /** Jumping for joy while he waits to set off. */
  cheering: boolean
  /** 0 = still aboard (hidden), 1 = on the island; eases up as he steps off. */
  shown: number
  /** Walk cycle, for the hop. */
  cycle: number
  walking: boolean
}

export const CREW_SIZE = 6

/** World units per second: a stroll off the ship, a run between building sites. */
const WALK = 1.7
const RUN = 3.3
const GAP_S = 0.38
const TURN = 10

const mate = (): Mate => ({
  x: 0, y: 0, z: 0, heading: 0, path: [], face: 0, delay: 0, speed: WALK,
  shown: 0, cycle: 0, walking: false, working: false, cheering: false,
})
export const crew: Mate[] = Array.from({ length: CREW_SIZE }, mate)

/** Bumped whenever a mate moves, so the scene knows to rewrite its instances. */
export let crewVersion = 0

/** The pier they landed at: its deck is walkable. */
let pier: { x0: number; x1: number; z: number; y: number } | null = null

/** Half the deck's width, with a little slack. */
const DECK_HALF = 0.45

/** What a mate stands on at a world position: the pier's deck, or the ground. */
function footY(x: number, z: number): number {
  if (pier && x >= pier.x0 && x <= pier.x1 && Math.abs(z - pier.z) <= DECK_HALF) return pier.y
  return Math.max(SEA_Y, groundAt(useIslandStore.getState().field, x, z))
}

/** Dry ground: not the sea and not a pond. */
const isLand = (x: number, z: number) => {
  const tx = Math.floor(x + HALF)
  const tz = Math.floor(z + HALF)
  if (!inBounds(tx, tz)) return false
  const { height, type } = useIslandStore.getState()
  const i = idx(tx, tz)
  return height[i] > 0 && type[i] !== TileType.Water
}

type Point = readonly [number, number]

/** The straight walk from `a` to `b` stays on dry ground. */
function clear(a: Point, b: Point): boolean {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.35)
  for (let k = 1; k < n; k++) {
    const t = k / n
    if (!isLand(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false
  }
  return true
}

/** Waypoints from `a` to `b`: straight if that stays dry, else around the water by one side step. */
function route(a: Point, b: Point): Point[] {
  if (clear(a, b)) return [b]
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const px = -(b[1] - a[1]) / d
  const pz = (b[0] - a[0]) / d
  for (const k of [1.5, -1.5, 3, -3, 4.5, -4.5]) {
    const mid: Point = [(a[0] + b[0]) / 2 + px * k, (a[1] + b[1]) / 2 + pz * k]
    if (isLand(mid[0], mid[1]) && clear(a, mid) && clear(mid, b)) return [mid, b]
  }
  return [b]
}

/**
 * Where each mate waits on the beach, as [inland, across] offsets from the
 * pier's shore end. The captain stands in front, the men in a loose group behind.
 */
const BEACH: ReadonlyArray<readonly [number, number]> = [
  [1.7, 0.6],
  [1.0, 1.35],
  [2.35, -0.5],
  [2.65, 1.65],
  [1.55, 2.25],
  [3.05, 0.55],
]

/** Turns (in y) they settle into: toward the island's middle, each a little differently. */
const LOOK = [0.9, 1.5, 1.2, 0.5, 0.7, 1.35]

/**
 * Everyone leaves the ship: one after another they appear at the far end of the
 * pier, walk its deck to the shore and spread out on the beach. `deckY` is the
 * world height of the deck's top, `length` how far the pier reaches from `at`.
 */
export function landCrew(at: Placement, deckY: number, length: number) {
  const far = at.x + PIER_DIR * length
  pier = { x0: Math.min(at.x, far) - 0.1, x1: Math.max(at.x, far) + 0.1, z: at.z, y: deckY }
  crew.forEach((m, k) => {
    // Two lanes on the deck, so they don't walk through each other.
    const lane = (k % 2 ? 0.16 : -0.16)
    const [inland, across] = BEACH[k]
    let bx = at.x - PIER_DIR * inland
    const bz = at.z + across
    // The shore isn't straight: step further inland until there's ground underfoot.
    for (let n = 0; n < 6 && !isLand(bx, bz); n++) bx -= PIER_DIR * 0.5
    m.x = far - PIER_DIR * 0.45
    m.z = at.z + lane
    m.y = deckY
    m.heading = Math.atan2(-PIER_DIR, 0)
    m.path = [
      [at.x - PIER_DIR * 0.35, at.z + lane],
      [bx, bz],
    ]
    m.face = LOOK[k]
    m.delay = k * GAP_S
    m.speed = WALK
    m.shown = 0
    m.cycle = 0
    m.walking = m.working = m.cheering = false
  })
  crewVersion++
}

/** The men hammer once they stand at the site (crewWork). */
let workOn = false

/** Where the men stand around a site: an arc on the default camera's side (+x +z), so the build stays in view. */
const ARC = [45, 10, 80, -25, 115].map((deg) => (deg * Math.PI) / 180)
const CAPTAIN_ARC = (150 * Math.PI) / 180

/**
 * Everyone runs to the building site at world `cx`/`cz` and stands around it,
 * `radius` out (the captain a little further back, to one side). `cheer` holds
 * them where they are for a moment first, jumping (the last build just rose).
 */
export function sendCrewTo(cx: number, cz: number, radius: number, cheer = false) {
  workOn = false
  crew.forEach((m, k) => {
    const a = k === 0 ? CAPTAIN_ARC : ARC[k - 1]
    let r = radius + (k === 0 ? 0.6 : 0)
    let to: Point = [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
    // Water or sea there: stand further out.
    for (let n = 0; n < 4 && !isLand(to[0], to[1]); n++) {
      r += 0.5
      to = [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
    }
    // Still on the pier (or not off the ship yet): walk its deck to the shore first.
    const ashore: Point[] = pier && !isLand(m.x, m.z) && m.path.length ? [m.path[0]] : []
    const from: Point = ashore[0] ?? [m.x, m.z]
    m.path = [...ashore, ...route(from, to)]
    m.face = Math.atan2(cx - to[0], cz - to[1])
    m.speed = RUN
    m.working = false
    if (cheer && m.shown >= 1) m.delay = 0.55 + k * 0.07
  })
  crewVersion++
}

/**
 * The work is done: everyone runs to line up at `spots` (world x/z, one per
 * mate, captain first) and turns to `face`, after a cheer where they stand.
 * `instant` puts them there at once (a returning visitor finds them waiting).
 */
export function gatherCrew(spots: ReadonlyArray<Point>, face: number, instant = false) {
  workOn = false
  crew.forEach((m, k) => {
    if (instant) {
      const [x, z] = spots[k]
      Object.assign(m, { x, z, y: footY(x, z), heading: face, face, path: [], delay: 0, shown: 1, cycle: 0, walking: false, working: false, cheering: false })
      return
    }
    const ashore: Point[] = pier && !isLand(m.x, m.z) && m.path.length ? [m.path[0]] : []
    m.path = [...ashore, ...route(ashore[0] ?? [m.x, m.z], spots[k])]
    m.face = face
    m.speed = RUN
    m.working = false
    if (m.shown >= 1) m.delay = 0.55 + k * 0.07
  })
  crewVersion++
}

/** Seconds of celebrating left: whoever stands still jumps for joy. */
let party = 0

/** Celebrate for `seconds` (the ending's sunset). */
export function crewParty(seconds: number) {
  party = seconds
  crewVersion++
}

/** Start or stop the hammering. Men still on their way join in as they arrive. */
export function crewWork(on: boolean) {
  workOn = on
  if (!on) for (const m of crew) m.working = false
  crewVersion++
}

/** How many of the men (not the captain) stand at the site, ready to build. */
export function crewReady(): number {
  let n = 0
  crew.forEach((m, k) => {
    if (k > 0 && m.shown >= 1 && m.delay <= 0 && m.path.length === 0) n++
  })
  return n
}

/** Shortest way round from angle `a` to `b`. */
const turnTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/**
 * Advance the crew by `dt` seconds. Returns true while anyone is still waiting
 * to leave, walking or turning (keep rendering), false once all stand still.
 */
export function stepCrew(dt: number): boolean {
  let active = false
  party = Math.max(0, party - dt)
  for (let k = 0; k < crew.length; k++) {
    const m = crew[k]
    if (m.delay > 0) {
      m.delay -= dt
      // Already ashore: a little jump while he waits.
      m.cheering = m.shown >= 1 && m.delay > 0
      m.cycle = m.cheering ? m.cycle + dt * 13 : 0
      active = true
      continue
    }
    let busy = false
    if (m.shown < 1) {
      m.shown = Math.min(1, m.shown + dt / 0.22)
      busy = true
    }
    let want = m.face
    const next = m.path[0]
    if (next) {
      const dx = next[0] - m.x
      const dz = next[1] - m.z
      const d = Math.hypot(dx, dz)
      const step = m.speed * dt
      if (d <= step) {
        m.x = next[0]
        m.z = next[1]
        m.path.shift()
      } else {
        m.x += (dx / d) * step
        m.z += (dz / d) * step
        want = Math.atan2(dx, dz)
      }
      m.cycle += dt * (m.speed > WALK ? 17 : 12)
      m.walking = m.path.length > 0
      if (!m.walking) m.cycle = 0
      busy = true
    } else if (workOn && k > 0) {
      m.working = true
      m.cycle += dt * 11
      busy = true
    } else if (party > 0) {
      // Each at his own pace, so they don't jump in step.
      m.cheering = true
      m.cycle += dt * (7 + (k % 3) * 1.3)
      busy = true
    } else if (m.cheering) {
      m.cheering = false
      m.cycle = 0
      busy = true
    }
    const turn = turnTo(m.heading, want)
    if (Math.abs(turn) > 0.01) {
      m.heading += turn * Math.min(1, dt * TURN)
      busy = true
    }
    const foot = footY(m.x, m.z)
    if (Math.abs(foot - m.y) > 0.002) {
      // Ease over the step off the deck and up terraces instead of snapping.
      m.y += (foot - m.y) * Math.min(1, dt * 14)
      busy = true
    }
    if (busy) active = true
  }
  if (active) crewVersion++
  return active
}
