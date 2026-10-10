import { TOUR } from './quests'

/**
 * The scroll story, start to end: which stretch of the page plays what. Pure
 * data built from TOUR, so reordering stops or retiming the tour never touches
 * scene code. Lengths are in screen heights of scrolling.
 */

export type Part = 'sail' | 'land' | 'walk' | 'build' | 'card' | 'gather' | 'sunset'

/** One stretch of the page; `from`/`to` are scroll progress (0..1). `stop` indexes TOUR, -1 outside the stops. */
export type Segment = { part: Part; stop: number; from: number; to: number }

const SAIL = 1
const LAND = 0.5
const WALK = 0.45
const BUILD = 0.5
const CARD = 0.6
const GATHER = 0.4
const SUNSET = 0.6

const lengths: Array<readonly [Part, number, number]> = [
  ['sail', -1, SAIL],
  ['land', -1, LAND],
  ...TOUR.flatMap((_, stop) => [
    ['walk', stop, WALK] as const,
    ['build', stop, BUILD] as const,
    ['card', stop, CARD] as const,
  ]),
  ['gather', -1, GATHER],
  ['sunset', -1, SUNSET],
]

/** Screen heights of scrolling from the top of the story to its end. */
export const SCREENS = lengths.reduce((sum, [, , len]) => sum + len, 0)

export const SEGMENTS: Segment[] = []
{
  let at = 0
  for (const [part, stop, len] of lengths) {
    SEGMENTS.push({ part, stop, from: at / SCREENS, to: (at + len) / SCREENS })
    at += len
  }
}

/** The stretch that plays `part` (of tour stop `stop`, for walk, build and card). */
export function segmentOf(part: Part, stop = -1): Segment {
  const seg = SEGMENTS.find((s) => s.part === part && s.stop === stop)
  if (!seg) throw new Error(`No ${part} segment for stop ${stop}`)
  return seg
}

/** How far through `seg` the scroll is: 0 before it, 1 after it. */
export function progressIn(seg: Segment, value: number): number {
  return Math.min(1, Math.max(0, (value - seg.from) / (seg.to - seg.from)))
}

/** Where the scroll is in the story: the stretch it is on and how far through it (0..1). */
export function beatAt(value: number): { seg: Segment; t: number } {
  const seg = SEGMENTS.find((s) => value < s.to) ?? SEGMENTS[SEGMENTS.length - 1]
  return { seg, t: progressIn(seg, value) }
}

/**
 * Inside a build stretch: the crew hammers all the way through, the quest's
 * clicks land one by one up to PLACE_AT, where the landmark is placed, and it
 * rises over the rest.
 */
export const PLACE_AT = 0.45
const CLICKS_FROM = 0.08
const CLICKS_TO = 0.38

/** How many of a quest's `count` clicks have landed, `t` of the way through its build stretch. */
export function clicksDue(count: number, t: number): number {
  if (count === 0 || t < CLICKS_FROM) return 0
  if (count === 1) return 1
  return Math.min(count, 1 + Math.floor(((t - CLICKS_FROM) / (CLICKS_TO - CLICKS_FROM)) * (count - 1)))
}

/** How far tour stop `stop`'s landmark has risen (0..1) at scroll progress `value`. */
export function riseAt(stop: number, value: number): number {
  const t = progressIn(segmentOf('build', stop), value)
  return Math.min(1, Math.max(0, (t - PLACE_AT) / (1 - PLACE_AT)))
}
