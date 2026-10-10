import { TOUR } from './quests'

/**
 * The story, start to end, as one line of progress from 0 to 1: which stretch
 * of it plays what, and the stops no single gesture can scroll past (see
 * scroll.ts). Pure data built from TOUR, so reordering stops or retiming the
 * tour never touches scene code.
 */

export type Part = 'sail' | 'land' | 'walk' | 'build' | 'card' | 'gather' | 'sunset' | 'contact'

/** One stretch of the page; `from`/`to` are scroll progress (0..1). `stop` indexes TOUR, -1 outside the stops. */
export type Segment = { part: Part; stop: number; from: number; to: number }

/** Seconds one unit of length takes when a step is played (keys, the on-screen hints) instead of scrolled. */
export const SECONDS_PER_UNIT = 2.6

// Lengths are screen heights of scrolling. A building (card to card) is about 1.8 screens:
// the walk, the build piece by piece over several turns of the wheel, the card.
// About 12 screens in all: some 25 s of scrolling at an easy pace, which with five cards
// to read makes a tour of 60-90 s.
const SAIL = 0.9
const LAND = 0.6
const WALK = 0.4
const BUILD = 0.95
/** One gesture ends in the middle of each card's stretch: half of this settles onto the card, half leaves it. */
const CARD = 0.4
const GATHER = 0.4
const SUNSET = 0.6
const CONTACT = 0.35

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
  ['contact', -1, CONTACT],
]

/** The whole story's length, in screen heights of scrolling. */
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
 * is put together over the rest.
 */
export const PLACE_AT = 0.28
const CLICKS_FROM = 0.05
const CLICKS_TO = 0.24

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

/** How far through the landing the crew is all ashore; the story stops just after. */
export const ASHORE_AT = 0.9

/**
 * Where one gesture has to end: the top, the landing (crew on the beach, the
 * captain's greeting up), each building standing with its card up, and the
 * contact card at the end.
 */
export const STOPS: number[] = (() => {
  const land = segmentOf('land')
  const cards = TOUR.map((_, stop) => {
    const card = segmentOf('card', stop)
    return (card.from + card.to) / 2
  })
  return [0, land.from + (land.to - land.from) * 0.96, ...cards, 1]
})()

/** The stop at which tour stop `stop`'s card is up. */
export const stopOfCard = (stop: number) => stop + 2

/** Where a returning visitor picks up, with `built` tour stops standing: their last card, or the end after all of them. */
export function stopForBuilt(built: number): number {
  if (built <= 0) return 0
  return built >= TOUR.length ? STOPS.length - 1 : stopOfCard(built - 1)
}

/** Seconds the story takes to play from progress `from` to `to`. */
export function secondsBetween(from: number, to: number): number {
  return Math.abs(to - from) * SCREENS * SECONDS_PER_UNIT
}
