import { useIslandStore } from '../store/useIslandStore'
import { HALF, SEA_Y, STEP, TileType } from '../world/constants'
import { idx, inBounds } from '../world/grid'
import { isTree } from '../world/plantRules'
import { groundAt } from '../world/terrainField'
import { PIER_DIR, type Placement } from './landmarks'

/**
 * The ship's crew: the captain (index 0) and five men who step off at the pier,
 * run to each building site and hammer there (useCrewDirector decides when), and stroll around the finished island. Plain mutable state stepped from the scene's frame loop
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
  /** Seconds he stands about before his next stroll (crewWander). */
  rest: number
  /** The last places he strolled to (world x/z), so the next stroll goes somewhere new. */
  been: Array<readonly [number, number]>
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
  shown: 0, cycle: 0, walking: false, working: false, cheering: false, rest: 0, been: [],
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
  wander = false
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
  wander = false
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
  wander = false
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

/** Things to walk around, as world x/z and a radius: the lighthouse, the grove, the cabin, the falls. */
export type Obstacle = readonly [x: number, z: number, r: number]

/** Strolling around the finished island (crewWander). */
let wander = false
let obstacles: ReadonlyArray<Obstacle> = []

/** How far one stroll goes, and how long they stand about between two. */
const STROLL_MIN = 2
const STROLL_MAX = 6
/** How many past strolls each one remembers, and how far a new one should be from all of them. */
const BEEN_MAX = 8
const BEEN_APART = 3
const REST_MIN = 2
const REST_MAX = 7

/**
 * The island is finished: from now on everyone strolls around it on their own,
 * a few steps at a time with a rest in between, always on dry ground and
 * around `avoid`. They leave the cabin one after another.
 */
export function crewWander(avoid: ReadonlyArray<Obstacle>) {
  wander = true
  obstacles = avoid
  crew.forEach((m, k) => {
    m.rest = 0.6 + k * 0.5 + Math.random() * 1.5
    m.been = [[m.x, m.z]]
  })
}

/** Tiles a stroll goes around: trees and stone stacks (the visitor may have added some). */
function blockedTiles(): Set<number> {
  const { plants, stones } = useIslandStore.getState()
  const blocked = new Set<number>()
  for (const p of plants) if (isTree(p.kind)) blocked.add(p.tile)
  for (let i = 0; i < stones.length; i++) if (stones[i] > 0) blocked.add(i)
  return blocked
}

/**
 * A stroll from `a` to `b` is fine: dry ground all the way (the end too), no
 * tree, stone or landmark in it, and no cliff to climb. Starting inside an
 * obstacle's circle is allowed as long as the walk leads out of it.
 */
function strollClear(a: Point, b: Point, blocked: Set<number>): boolean {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3)
  let y = footY(a[0], a[1])
  for (let k = 1; k <= n; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / n
    const z = a[1] + ((b[1] - a[1]) * k) / n
    if (!isLand(x, z) || blocked.has(idx(Math.floor(x + HALF), Math.floor(z + HALF)))) return false
    for (const [ox, oz, r] of obstacles) {
      const d = Math.hypot(x - ox, z - oz)
      if (d < r && d < Math.hypot(a[0] - ox, a[1] - oz)) return false
    }
    const fy = footY(x, z)
    if (Math.abs(fy - y) > STEP * 1.3) return false
    y = fy
  }
  return true
}

/**
 * Pick `m`'s next stroll: a random spot nearby he can walk to, clear of where
 * the others stand or are heading, and away from the places he has been
 * lately (the furthest from them, if none of the tries is far enough).
 */
function stroll(m: Mate): boolean {
  const from: Point = [m.x, m.z]
  const blocked = blockedTiles()
  // The ground was dug away under him: any dry spot will do, straight out of the water.
  const stuck = !isLand(m.x, m.z)
  let best: Point | null = null
  let bestApart = -1
  for (let n = 0; n < 14; n++) {
    const a = Math.random() * Math.PI * 2
    const d = STROLL_MIN + Math.random() * (STROLL_MAX - STROLL_MIN)
    const to: Point = [m.x + Math.cos(a) * d, m.z + Math.sin(a) * d]
    if (!isLand(to[0], to[1])) continue
    if (!stuck && !strollClear(from, to, blocked)) continue
    const taken = crew.some((o) => {
      if (o === m) return false
      const [ox, oz] = o.path[o.path.length - 1] ?? [o.x, o.z]
      return Math.hypot(ox - to[0], oz - to[1]) < 0.9
    })
    if (taken) continue
    const apart = Math.min(...m.been.map(([bx, bz]) => Math.hypot(bx - to[0], bz - to[1])))
    if (apart > bestApart) {
      best = to
      bestApart = apart
    }
    if (apart >= BEEN_APART) break
  }
  if (!best) return false
  m.path = [best]
  m.speed = WALK
  m.been.push(best)
  if (m.been.length > BEEN_MAX) m.been.shift()
  return true
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
 * to leave, walking or turning (keep rendering at full rate), false once all
 * stand still. Strolling (crewWander) returns false too: it is happy with the
 * idle frame rate.
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
      if (wander && isLand(m.x, m.z) && !isLand(m.x + (dx / d) * Math.min(d, 0.3), m.z + (dz / d) * Math.min(d, 0.3))) {
        // The visitor dug water into his way: stop here and pick another stroll.
        m.path = []
      } else if (d <= step) {
        m.x = next[0]
        m.z = next[1]
        m.path.shift()
        // Strolling: stay turned the way he came.
        if (wander && !m.path.length) m.face = m.heading
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
    } else if (wander) {
      m.rest -= dt
      if (m.rest <= 0) m.rest = stroll(m) ? REST_MIN + Math.random() * (REST_MAX - REST_MIN) : 1
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
  return active && !wander
}
