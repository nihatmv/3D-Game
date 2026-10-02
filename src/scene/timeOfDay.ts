import { Color, Vector3 } from 'three'
import { PALETTE } from '../world/constants'

/** The timeline's range, in hours. Night sits at both ends. */
export const HOUR_MIN = 5
export const HOUR_MAX = 23
/** The ending's golden hour. */
export const HOUR_GOLDEN = 18.5

/** The visitor's local time in hours (14.5 = 2:30 pm). */
export function clockHour(now = new Date()) {
  return now.getHours() + now.getMinutes() / 60
}

/** The visitor's local time on the timeline; late night and small hours sit at its night ends. */
export function liveHour(now = new Date()) {
  const h = clockHour(now)
  return h < HOUR_MIN ? HOUR_MIN : Math.min(HOUR_MAX, h)
}

/** Golden-hour colours the day palette blends toward. */
export const SUNSET_PALETTE = {
  sky: '#f7c08e',
  sun: '#ffd0a0',
  hemiSky: '#ffe0bd',
  hemiGround: '#b9b4c8',
  deepWater: '#4f9fb4',
  water: '#e8cfa6',
  foam: '#fff1de',
}

/** Night colours for the water and glass, blended in by `tod.night`. */
export const NIGHT_PALETTE = {
  deepWater: '#1d3658',
  water: '#2e5676',
  foam: '#9aabc8',
  fall: '#47789a',
}

type Key = {
  hour: number
  /** Horizon, fog and background. */
  sky: string
  zenith: string
  light: string
  lightI: number
  hemiSky: string
  hemiGround: string
  hemiI: number
  /** The timeline track's colour at this hour. */
  ui: string
}

const NIGHT = {
  sky: '#2a3462',
  zenith: '#0d1334',
  light: '#b4c4ff',
  lightI: 0.75,
  hemiSky: '#8494d4',
  hemiGround: '#3c4668',
  hemiI: 1.0,
  ui: '#2b3566',
}
const DAY = {
  sky: PALETTE.sky,
  zenith: '#a9d6ee',
  light: PALETTE.sun,
  lightI: 2.1,
  hemiSky: PALETTE.sun,
  hemiGround: PALETTE.ground,
  hemiI: 1.35,
  ui: '#8fd0ea',
}

/** Sorted by hour; the day keys are exactly the old daylight look, golden the old sunset. */
export const KEYS: Key[] = [
  { hour: 4.5, ...NIGHT },
  { hour: 6.5, sky: '#f6c3b0', zenith: '#8fa3d6', light: '#ffd2b8', lightI: 1.5, hemiSky: '#f7d7cc', hemiGround: '#a7a9c0', hemiI: 1.15, ui: '#f3a99a' },
  { hour: 9, ...DAY },
  { hour: 16, ...DAY },
  {
    hour: HOUR_GOLDEN,
    sky: SUNSET_PALETTE.sky,
    zenith: '#d7a3b8',
    light: SUNSET_PALETTE.sun,
    lightI: 2.2,
    hemiSky: SUNSET_PALETTE.hemiSky,
    hemiGround: SUNSET_PALETTE.hemiGround,
    hemiI: 1.4,
    ui: '#f6a25e',
  },
  { hour: 20, sky: '#c98a8f', zenith: '#4a4a86', light: '#ffb08a', lightI: 1.1, hemiSky: '#d8a6b0', hemiGround: '#7f7a9a', hemiI: 1.05, ui: '#9b6b9e' },
  { hour: 21.5, ...NIGHT },
  { hour: 24, ...NIGHT },
]

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Directions as (azimuth, elevation), azimuth = atan2(z, x). The home view
// looks toward −x −z (−135°): sunrise and moonrise sit front-left of it, sunset
// front-right, and they stay low there so a camera tilted down to the horizon
// (it can't look higher than ~13° above it) shows them. Noon is high and
// behind the camera, where the daylight always came from.
const DEG = Math.PI / 180
const RISE_AZ = -152 * DEG
const SET_AZ = -117 * DEG
// The sun keeps turning the same way: rise → behind the camera → set.
const NOON_AZ = (Math.atan2(9, 14) - 2 * Math.PI)
const NOON_EL = Math.asin(24 / Math.hypot(14, 24, 9))
const SUN_SET_AZ = SET_AZ - 2 * Math.PI
const SUNRISE = 5.9
const SUNSET = 19.6
/** Late morning to mid-afternoon, the sun holds where the daylight always was. */
const NOON_FROM = 11
const NOON_TO = 14
const MOONRISE = 19.5
const MOON_HOURS = 11
const MOON_MAX_EL = 11 * DEG

function fromAngles(az: number, el: number, out: Vector3) {
  return out.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))
}

/** Low for a while after rising and before setting, so dawn and sunset show above the sea (and, with the
 * azimuth eased the same way, in front of the home view). */
const rise = (u: number) => Math.sin(Math.min(1, Math.max(0, u)) * Math.PI / 2) ** 1.8

/** Direction to the sun: rise → noon → set, dipping under the horizon outside the day. */
function sunDir(h: number, out: Vector3) {
  if (h < SUNRISE) return fromAngles(RISE_AZ, -Math.min(1, SUNRISE - h) * 12 * DEG, out)
  if (h > SUNSET) return fromAngles(SUN_SET_AZ, -Math.min(1, h - SUNSET) * 12 * DEG, out)
  if (h < NOON_FROM) {
    const u = (h - SUNRISE) / (NOON_FROM - SUNRISE)
    return fromAngles(RISE_AZ + (NOON_AZ - RISE_AZ) * u * u, NOON_EL * rise(u), out)
  }
  if (h > NOON_TO) {
    const u = (h - NOON_TO) / (SUNSET - NOON_TO)
    return fromAngles(NOON_AZ + (SUN_SET_AZ - NOON_AZ) * (1 - (1 - u) ** 2), NOON_EL * rise(1 - u), out)
  }
  return fromAngles(NOON_AZ, NOON_EL, out)
}

/** Direction to the moon: rises front-left at dusk and hangs low across the front, setting by dawn. */
function moonDir(h: number, out: Vector3) {
  const p = ((((h - MOONRISE) % 24) + 24) % 24) / MOON_HOURS
  if (p > 1) return fromAngles(RISE_AZ, -12 * DEG, out)
  return fromAngles(RISE_AZ + (SET_AZ - RISE_AZ) * p, MOON_MAX_EL * Math.sin(p * Math.PI), out)
}

const keyColors = KEYS.map((k) => ({
  sky: new Color(k.sky),
  zenith: new Color(k.zenith),
  light: new Color(k.light),
  hemiSky: new Color(k.hemiSky),
  hemiGround: new Color(k.hemiGround),
}))

/**
 * The current time of day, eased toward the story store's `hour` by
 * <Lighting/>. Plain module state, so shaders read it every frame without
 * React re-renders; `version` bumps on each change.
 *
 * - `warm`: golden-ness (dawn and evening), 0..1
 * - `night`: 0..1
 * - `glow`: how lit the windows and fireflies are, 0..1
 */
export const tod = {
  hour: 0,
  version: 0,
  warm: 0,
  night: 0,
  glow: 0,
  sky: new Color(),
  zenith: new Color(),
  light: new Color(),
  lightI: 0,
  hemiSky: new Color(),
  hemiGround: new Color(),
  hemiI: 0,
  sun: new Vector3(),
  moon: new Vector3(),
  /** Where the directional light shines from: the sun by day, the moon by night. */
  lightDir: new Vector3(),
}

/** Recompute everything in `tod` for an hour (no allocations). */
export function setTodHour(h: number) {
  tod.hour = h
  tod.version++
  let i = 0
  while (i < KEYS.length - 2 && h > KEYS[i + 1].hour) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = ss(a.hour, b.hour, h)
  const ca = keyColors[i]
  const cb = keyColors[i + 1]
  tod.sky.lerpColors(ca.sky, cb.sky, t)
  tod.zenith.lerpColors(ca.zenith, cb.zenith, t)
  tod.light.lerpColors(ca.light, cb.light, t)
  tod.hemiSky.lerpColors(ca.hemiSky, cb.hemiSky, t)
  tod.hemiGround.lerpColors(ca.hemiGround, cb.hemiGround, t)
  tod.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t
  tod.lightI = a.lightI + (b.lightI - a.lightI) * t

  tod.night = Math.max(1 - ss(5.2, 7, h), ss(19.6, 21.5, h))
  tod.warm = Math.max(1 - ss(6.5, 9, h), ss(16, HOUR_GOLDEN, h)) * (1 - tod.night)
  tod.glow = Math.max(ss(16, HOUR_GOLDEN, h), tod.night)

  sunDir(h, tod.sun)
  moonDir(h, tod.moon)
  // The light follows whichever body is up and fades out near the horizon, so the swap can't be seen.
  const body = tod.sun.y > 0 ? tod.sun : tod.moon
  tod.lightDir.copy(body)
  tod.lightI *= ss(0, 0.06, body.y)
}

// Start at the visitor's time, so the first frame doesn't fade in from midday.
setTodHour(liveHour())
