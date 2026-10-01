import { create } from 'zustand'
import { CONFIG, PROJECTS, type Demo } from './projects'
import { latestCommit, type Commit } from './githubCommit'

/**
 * State for the landmark mini demos (see `Demo` in projects.ts), shared by the
 * scene (lighthouse label, pond bubble) and the cards. No per-frame work here.
 */

/** Samples scaled to 0..1; `seconds` is how long the whole file lasts (for the card's scroll speed). */
type Breathing = { samples: number[]; bpm: number; seconds: number }
export type CueState = 'idle' | 'listening' | 'recognized'

type DemoState = {
  /** null until loaded; the fallback from projects.ts if GitHub can't be reached. */
  commit: Commit | null
  breathing: Breathing | null
  cue: CueState
}

export const useDemoStore = create<DemoState>(() => ({ commit: null, breathing: null, cue: 'idle' }))

/** The first project's demo of a kind (each landmark shows one). */
export function demoOf<K extends Demo['kind']>(kind: K): { projectId: string; demo: Extract<Demo, { kind: K }> } | null {
  for (const p of PROJECTS) if (p.demo?.kind === kind) return { projectId: p.id, demo: p.demo as Extract<Demo, { kind: K }> }
  return null
}

let commitRequested = false

/** Fetch the latest commit once (cached by githubCommit.ts), falling back to the data file. */
export function loadCommit() {
  if (commitRequested) return
  commitRequested = true
  const fallback = demoOf('commit')?.demo.fallback
  latestCommit(CONFIG.githubUser).then((c) => {
    useDemoStore.setState({ commit: c ?? (fallback ? { ...fallback, live: false } : null) })
  })
}

/** Default breathing rate when the sample file doesn't say. */
const DEFAULT_BPM = 15
let breathingRequested = false

/** Load the breathing samples once and scale them to 0..1. */
export function loadBreathing() {
  const d = demoOf('breathing')?.demo
  if (!d || breathingRequested) return
  breathingRequested = true
  fetch(d.samples)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { samples?: number[]; breathsPerMinute?: number; sampleRateHz?: number } | null) => {
      const raw = j?.samples?.filter((v) => Number.isFinite(v)) ?? []
      if (raw.length < 2) return
      const lo = Math.min(...raw)
      const span = Math.max(...raw) - lo || 1
      useDemoStore.setState({
        breathing: {
          samples: raw.map((v) => (v - lo) / span),
          bpm: j?.breathsPerMinute ?? DEFAULT_BPM,
          seconds: raw.length / (j?.sampleRateHz ?? 10),
        },
      })
    })
    .catch(() => {})
}

/** Breaths per minute for the lighthouse glow (the default until the file loads). */
export const breathingBpm = () => useDemoStore.getState().breathing?.bpm ?? DEFAULT_BPM

/** How long the "Recognized" bubble stays over the pond. */
const BUBBLE_MS = 5000
/** Listening time with the built-in jingle (a clip uses its own length, capped). */
const JINGLE_MS = 2200
const MAX_CLIP_MS = 6000

let cueTimer: ReturnType<typeof setTimeout> | undefined
let audio: HTMLAudioElement | null = null

/** Cue demo: play a short clip, ripple the pond while "listening", then show the song. */
export function playCue() {
  const d = demoOf('song')?.demo
  if (!d || useDemoStore.getState().cue === 'listening') return
  useDemoStore.setState({ cue: 'listening' })
  clearTimeout(cueTimer)

  const recognize = () => {
    clearTimeout(cueTimer)
    audio?.pause()
    useDemoStore.setState({ cue: 'recognized' })
    cueTimer = setTimeout(() => useDemoStore.setState({ cue: 'idle' }), BUBBLE_MS)
  }

  if (d.audio) {
    audio ??= new Audio(d.audio)
    audio.currentTime = 0
    audio.onended = recognize
    cueTimer = setTimeout(recognize, MAX_CLIP_MS)
    audio.play().catch(() => {
      clearTimeout(cueTimer)
      playJingle()
      cueTimer = setTimeout(recognize, JINGLE_MS)
    })
  } else {
    playJingle()
    cueTimer = setTimeout(recognize, JINGLE_MS)
  }
}

let ctx: AudioContext | null = null

/** A short synthesized melody, used when no clip is set (or it fails to play). */
function playJingle() {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    const notes = [523.25, 659.25, 783.99, 659.25, 880, 783.99] // C5 E5 G5 E5 A5 G5
    const t0 = ctx.currentTime + 0.05
    notes.forEach((f, k) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      const at = t0 + k * 0.28
      osc.type = 'triangle'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.12, at + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.42)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(at)
      osc.stop(at + 0.45)
    })
  } catch {
    // No audio available: the ripples and the bubble still play.
  }
}
