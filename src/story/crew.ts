import { emit } from '../scene/puffs'
import { useIslandStore } from '../store/useIslandStore'
import { useStoryStore } from '../store/useStoryStore'
import { HALF, SEA_Y, STEP, TileType } from '../world/constants'
import { idx, inBounds } from '../world/grid'
import { isTree } from '../world/plantRules'
import { groundAt } from '../world/terrainField'
import { PIER_DIR, type Placement } from './landmarks'
import { QUESTS, TOUR, type Quest } from './quests'
import { beatAt } from './timeline'

/**
 * The ship's crew: the captain (index 0) and five men. During the tour they
 * follow the scroll (scrubCrew): off the ship and onto the beach, on to each
 * building site, hammering through its build, and into a row at the cabin; they
 * walk back when the page scrolls back and stand still when it rests (but for
 * a short cheer as the sunset begins, stepParty). In free play they stroll
 * around the finished island on their own (stepCrew). Plain mutable state read by scene/story/Crew.tsx, so none of it
 * costs React renders.
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
  /** Seconds until he sets off on his first stroll. */
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

/** World units per second on a stroll. */
const WALK = 1.7
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

/** Tiles the tour digs into water (the pond): the crew keeps off them from the start, so a walk laid before the digging still holds after it. */
const toBeWater = new Set(
  TOUR.filter((q) => q.tool === 'water').flatMap((q) => q.clicks.map(([dx, dz]) => idx(q.area.x + dx, q.area.z + dz))),
)

/** Dry ground: not the sea and not a pond (dug already, or about to be). */
const isLand = (x: number, z: number) => {
  const tx = Math.floor(x + HALF)
  const tz = Math.floor(z + HALF)
  if (!inBounds(tx, tz)) return false
  const { height, type } = useIslandStore.getState()
  const i = idx(tx, tz)
  return height[i] > 0 && type[i] !== TileType.Water && !toBeWater.has(i)
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

/** Turns (in y) they settle into on the beach: toward the island's middle, each a little differently. */
const LOOK = [0.9, 1.5, 1.2, 0.5, 0.7, 1.35]

/** Where the men stand around a site: an arc on the default camera's side (+x +z), so the build stays in view. */
const ARC = [45, 10, 80, -25, 115].map((deg) => (deg * Math.PI) / 180)
const CAPTAIN_ARC = (150 * Math.PI) / 180
/** How far outside a quest's glowing ring the men stand. */
const STAND_OFF = 0.9

/** The row in front of the cabin, from its placement: where it starts, how far in front, the gap, and each mate's slot. */
const ROW_X = -2.8
const ROW_Z = 1.15
const ROW_GAP = 0.62
const ROW = [3, 0, 1, 2, 4, 5]
/** The row faces the default camera. */
const ROW_FACE = Math.PI / 4

/** Where a mate stands between walks, and which way he looks. */
type Stand = { at: Point; face: number }
/** One mate's walk: its waypoints and the distance walked at each. */
type Leg = { pts: Point[]; cum: number[] }

/** The pier's placement and length, for the walk off the ship. */
let dock: { at: Placement; length: number } | null = null

/** The pier the ship lies at: its deck (top at world height `deckY`) is where the crew steps off. */
export function setCrewPier(at: Placement, deckY: number, length: number) {
  const far = at.x + PIER_DIR * length
  pier = { x0: Math.min(at.x, far) - 0.1, x1: Math.max(at.x, far) + 0.1, z: at.z, y: deckY }
  dock = { at, length }
}

/** Spread out on the beach by the pier. */
function beachStands(): Stand[] {
  const at = dock?.at ?? { x: 0, z: 0 }
  return crew.map((_, k) => {
    const [inland, across] = BEACH[k]
    let bx = at.x - PIER_DIR * inland
    const bz = at.z + across
    // The shore isn't straight: step further inland until there's ground underfoot.
    for (let n = 0; n < 6 && !isLand(bx, bz); n++) bx -= PIER_DIR * 0.5
    return { at: [bx, bz], face: LOOK[k] }
  })
}

/** Around a quest's site, facing it (the captain a little further back, to one side). */
function siteStands(q: Quest): Stand[] {
  const cx = q.area.x - HALF + 0.5
  const cz = q.area.z - HALF + 0.5
  return crew.map((_, k) => {
    const a = k === 0 ? CAPTAIN_ARC : ARC[k - 1]
    let r = q.area.r + STAND_OFF + (k === 0 ? 0.6 : 0)
    let to: Point = [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
    // Water or sea there: stand further out.
    for (let n = 0; n < 4 && !isLand(to[0], to[1]); n++) {
      r += 0.5
      to = [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
    }
    return { at: to, face: Math.atan2(cx - to[0], cz - to[1]) }
  })
}

/** A row along the cabin's front, the captain in the middle and a step forward. */
function rowStands(cabin: Placement): Stand[] {
  return ROW.map((slot, k) => ({ at: [cabin.x + ROW_X + slot * ROW_GAP, cabin.z + ROW_Z + (k === 0 ? 0.2 : 0)], face: ROW_FACE }))
}

const cabinAt = () => {
  const q = QUESTS.find((q) => q.landmark === 'cabin')
  return q && useStoryStore.getState().placed[q.id]
}

/**
 * Stands and walks are worked out when the scroll first needs them (the ground
 * as it is then: a walk laid after the pond is dug goes around it) and kept, so
 * scrolling back and forth replays the same steps.
 */
const stands = new Map<string, Stand[]>()
const legs = new Map<string, Leg[]>()

function standsAt(place: 'beach' | 'row' | number): Stand[] {
  const key = String(place)
  let st = stands.get(key)
  if (!st) {
    const cabin = place === 'row' ? cabinAt() : undefined
    // No cabin to line up at (it can't be, this late): stay at the last site.
    if (place === 'row' && !cabin) return standsAt(TOUR.length - 1)
    st = place === 'beach' ? beachStands() : cabin ? rowStands(cabin) : siteStands(TOUR[place as number])
    stands.set(key, st)
  }
  return st
}

function toLeg(pts: Point[]): Leg {
  const cum = [0]
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
  return { pts, cum }
}

/** Off the ship: from the far end of the pier along its deck (two lanes, so they don't walk through each other) to the beach. */
function landingLegs(): Leg[] {
  let ls = legs.get('land')
  if (!ls && dock) {
    const { at, length } = dock
    const far = at.x + PIER_DIR * length
    ls = standsAt('beach').map((to, k) => {
      const lane = k % 2 ? 0.16 : -0.16
      return toLeg([[far - PIER_DIR * 0.45, at.z + lane], [at.x - PIER_DIR * 0.35, at.z + lane], to.at])
    })
    legs.set('land', ls)
  }
  return ls ?? []
}

/** From one stand to the next, around any water in between. */
function walkLegs(key: string, from: Stand[], to: Stand[]): Leg[] {
  let ls = legs.get(key)
  if (!ls) {
    ls = from.map((f, k) => toLeg([f.at, ...route(f.at, to[k].at)]))
    legs.set(key, ls)
  }
  return ls
}

/** Walk-cycle radians per world unit walked, and hammer blows per build. */
const STRIDE = 5.2
const BLOWS = 6
/** How much later each mate sets off than the one before, as a share of the stretch: off the ship in turn, between sites nearly together. */
const LAND_GAP = 0.1
const WALK_GAP = 0.035

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (u: number) => u * u * (3 - 2 * u)
/** Mate `k`'s own progress through a stretch that is `t` along, setting off `gap` after the one before. */
const staggered = (t: number, k: number, gap: number) => clamp01((t - k * gap) / (1 - (CREW_SIZE - 1) * gap))

function standAt(m: Mate, st: Stand) {
  m.x = st.at[0]
  m.z = st.at[1]
  m.heading = st.face
  m.walking = false
  m.cycle = 0
}

/** Put `m` `u` of the way along `leg` (walking backward when the page scrolls back), looking `from`/`to` at its ends. */
function walkLeg(m: Mate, leg: Leg, u: number, from: number, to: number, back: boolean) {
  const { pts, cum } = leg
  const last = pts.length - 1
  if (u <= 0 || u >= 1 || cum[last] === 0) {
    standAt(m, { at: u <= 0 ? pts[0] : pts[last], face: u <= 0 ? from : to })
    return
  }
  const d = smooth(u) * cum[last]
  let k = 1
  while (k < last && cum[k] < d) k++
  const f = (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)
  const dx = pts[k][0] - pts[k - 1][0]
  const dz = pts[k][1] - pts[k - 1][1]
  m.x = pts[k - 1][0] + dx * f
  m.z = pts[k - 1][1] + dz * f
  m.heading = Math.atan2(dx, dz) + (back ? Math.PI : 0)
  m.walking = true
  m.cycle = d * STRIDE
}

/** The scroll progress the crew was last put at, and the hammer blows struck so far in the current build. */
let scrubbed = -1
let blows = 0

/**
 * Put the crew where the story is at scroll progress `value` (timeline.ts):
 * aboard while the ship sails, down the pier in turn as it lands, across to
 * each site as the scroll walks them there, hammering through the build, still
 * for the card, and into the row at the cabin at the end. Does nothing unless
 * the scroll moved.
 */
export function scrubCrew(value: number) {
  if (value === scrubbed || !dock) return
  const back = value < scrubbed
  scrubbed = value
  const { seg, t } = beatAt(value)
  const here = seg.stop

  crew.forEach((m, k) => {
    m.path = []
    m.delay = 0
    m.working = m.cheering = false
    m.shown = seg.part === 'sail' ? 0 : 1
    if (seg.part === 'sail') {
      // Still aboard.
    } else if (seg.part === 'land') {
      const u = staggered(t, k, LAND_GAP)
      const leg = landingLegs()[k]
      m.shown = clamp01(u / 0.1)
      walkLeg(m, leg, u, Math.atan2(-PIER_DIR, 0), standsAt('beach')[k].face, back)
    } else if (seg.part === 'walk') {
      const from = standsAt(here > 0 ? here - 1 : 'beach')
      const to = standsAt(here)
      walkLeg(m, walkLegs(`walk${here}`, from, to)[k], staggered(t, k, WALK_GAP), from[k].face, to[k].face, back)
    } else if (seg.part === 'build') {
      standAt(m, standsAt(here)[k])
      // The men hammer; the captain watches.
      if (k > 0) {
        m.working = true
        m.cycle = t * BLOWS * Math.PI * 2 + k * 0.9
      }
    } else if (seg.part === 'card') {
      standAt(m, standsAt(here)[k])
    } else if (seg.part === 'gather') {
      const from = standsAt(TOUR.length - 1)
      const to = standsAt('row')
      walkLeg(m, walkLegs('gather', from, to)[k], staggered(t, k, WALK_GAP), from[k].face, to[k].face, back)
    } else {
      // In the row for the sunset and the contact card; a cheer (crewParty) runs on its own clock.
      const st = standsAt('row')[k]
      const cheer = party > 0
      const cycle = m.cycle
      standAt(m, st)
      m.cheering = cheer
      if (cheer) m.cycle = cycle
    }
    m.y = footY(m.x, m.z)
  })

  // Dust flies with each blow, on the way forward.
  const struck = seg.part === 'build' ? Math.floor(t * BLOWS) : 0
  if (struck > blows && !back) {
    const q = TOUR[here]
    const cx = q.area.x - HALF + 0.5
    const cz = q.area.z - HALF + 0.5
    emit('dust', cx, footY(cx, cz) + 0.15, cz, 5)
  }
  blows = struck
  // Scrolled back out of the sunset: the cheer is over.
  if (seg.part !== 'sunset' && seg.part !== 'contact') party = 0
  crewVersion++
}

/**
 * The cheer at the cabin, by `dt` seconds: whoever stands in the row jumps
 * for joy, each at his own pace. Returns true while it lasts (keep rendering
 * at full rate); it is the only thing the crew does on a clock during the tour.
 */
export function stepParty(dt: number): boolean {
  if (party <= 0) return false
  party = Math.max(0, party - dt)
  crew.forEach((m, k) => {
    m.cheering = party > 0
    m.cycle = party > 0 ? m.cycle + dt * (7 + (k % 3) * 1.3) : 0
  })
  crewVersion++
  return party > 0
}

/** Free play begins: everyone stands in the row in front of the cabin, whatever the scroll last did with them. */
export function gatherCrew(cabin: Placement) {
  wander = false
  rowStands(cabin).forEach((st, k) => {
    const m = crew[k]
    standAt(m, st)
    Object.assign(m, { y: footY(m.x, m.z), face: st.face, path: [], delay: 0, shown: 1, working: false, cheering: false })
  })
  crewVersion++
}

/** Seconds of celebrating left (stepParty). */
let party = 0

/** Celebrate for `seconds` (the sunset begins). */
export function crewParty(seconds: number) {
  party = seconds
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

/** Shortest way round from angle `a` to `b`. */
const turnTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/**
 * Free play: advance the strolling crew by `dt` seconds. Returns false while
 * they stroll (it is happy with the idle frame rate).
 */
export function stepCrew(dt: number): boolean {
  let active = false
  for (let k = 0; k < crew.length; k++) {
    const m = crew[k]
    if (m.delay > 0) {
      m.delay -= dt
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
      m.cycle += dt * 12
      m.walking = m.path.length > 0
      if (!m.walking) m.cycle = 0
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
