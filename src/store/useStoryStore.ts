import { create } from 'zustand'
import { QUESTS, TOUR, type LandmarkKind } from '../story/quests'
import { placeLandmark, type Placement } from '../story/landmarks'
import { track } from '../analytics'
import { loadProgress, saveProgress } from '../story/progress'
import { HOUR_GOLDEN, liveHour } from '../scene/timeOfDay'
import type { Part } from '../story/timeline'

export type StoryPhase = 'intro' | 'questing' | 'ending' | 'done'
export type ShipState = 'arriving' | 'docked'
/** The stretch of the scroll story that is on (timeline.ts); `stop` indexes TOUR, -1 outside the stops. */
export type Beat = { part: Part; stop: number }
/** A project id, or 'contact' for the final card. */
export type CardId = string

type StoryState = {
  phase: StoryPhase
  /** Index into TOUR of the next stop to build (TOUR.length once all are built). */
  questIndex: number
  /** Where the scroll is in the story. Set by the scroll director, and only when it changes. */
  beat: Beat
  /** Ids of quests whose landmark is built. */
  built: string[]
  /** Where each built quest's landmark stands. */
  placed: Record<string, Placement>
  /** Full card currently shown (Details on a stop's card, or a landmark clicked in free play), or null. */
  openCard: CardId | null
  /** Free play and the ending: landmark the camera flies to (CameraRig), or null for where it was. */
  focus: Placement | null
  shipState: ShipState
  /** Time of day (hours) that <Lighting/> eases toward; the HUD's timeline sets it. */
  hour: number
  /** Follow the visitor's clock. Dragging the timeline or the ending's sunset stops it. */
  hourLive: boolean
  /** Ease slowly into `hour` (the ending's sunset) instead of following the timeline. */
  hourSlow: boolean

  /** The scroll moved on to another stretch of the story. Closes an open full card. */
  setBeat: (beat: Beat) => void
  /** The next stop is built: place its landmark and move on. */
  completeQuest: (id: string) => void
  /** Build everything at once and go to the ending (dev and tests; the HUD's Skip scrolls there instead). */
  skipAll: () => void
  /** Every stop is built and the scroll is past the last one: the timed ending takes over (useEndingDirector). */
  startEnding: () => void
  /** Rebuild saved tour stops on load (progress.ts), on top of the pier. Partial: the page opens at the last one's card. All: the finished island at sunset with the contact card, no ending replay. */
  restore: (ids: string[]) => void
  /** Open a full card; with `at`, the camera flies to that landmark too. */
  openProject: (id: CardId, at?: Placement) => void
  /** Close the full card (and fly back, if the camera flew). */
  closeCard: () => void
  setShipState: (s: ShipState) => void
  /** The tour is done: the sun goes down and the camera flies to the cabin, where the crew gathers (useEndingDirector). */
  startSunset: () => void
  /** The story is over: show who built the island. */
  finishStory: () => void
  setHour: (hour: number) => void
  /** Go back to the visitor's clock, or catch up with it (called every minute). */
  followClock: () => void
}

export const useStoryStore = create<StoryState>((set, get) => ({
  phase: 'intro',
  questIndex: 0,
  beat: { part: 'sail', stop: -1 },
  built: [],
  placed: {},
  openCard: null,
  focus: null,
  shipState: 'arriving',
  hour: liveHour(),
  hourLive: true,
  hourSlow: false,

  setBeat: (beat) => {
    const started = get().phase === 'intro' && beat.part !== 'sail' && beat.part !== 'land'
    set({ beat, openCard: null, focus: null, ...(started ? { phase: 'questing' as const } : null) })
    if (started) track('tour_started')
  },

  completeQuest: (id) => {
    const { questIndex, built } = get()
    const q = TOUR[questIndex]
    if (!q || q.id !== id || built.includes(id)) return
    const next = questIndex + 1
    // Story state first: placing the landmark edits the island, and subscribers must see the stop as built.
    set({ built: [...built, id], questIndex: next })
    track('landmark_completed', { project: q.projectId ?? q.id, stop: next })
    const at = placeLandmark(q)
    set({ placed: { ...get().placed, [id]: at } })
  },

  skipAll: () => {
    set({
      built: QUESTS.map((q) => q.id),
      questIndex: TOUR.length,
      phase: 'ending',
      openCard: null,
      focus: null,
    })
    // Place every landmark still missing, in order (the lighthouse top needs its base).
    const placed = { ...get().placed }
    for (const q of QUESTS) if (!placed[q.id]) placed[q.id] = placeLandmark(q)
    set({ placed })
  },

  startEnding: () => {
    const { phase, questIndex } = get()
    if ((phase === 'intro' || phase === 'questing') && questIndex >= TOUR.length) set({ phase: 'ending', openCard: null, focus: null })
  },

  restore: (ids) => {
    if (!ids.length) return
    // Story state first: placing landmarks edits the island.
    const all = ids.length >= TOUR.length
    set({
      built: [...get().built, ...ids],
      questIndex: ids.length,
      phase: all ? 'done' : 'questing',
      openCard: all ? 'contact' : null,
      focus: null,
      ...(all ? { hour: HOUR_GOLDEN, hourLive: false } : null),
    })
    const placed = { ...get().placed }
    for (const q of TOUR) if (ids.includes(q.id)) placed[q.id] = placeLandmark(q)
    set({ placed })
  },

  openProject: (id, at) => set({ openCard: id, focus: at ?? null }),
  closeCard: () => set({ openCard: null, focus: null }),
  setShipState: (shipState) => set({ shipState }),
  startSunset: () => {
    const cabin = QUESTS.find((q) => q.landmark === 'cabin')
    set({ hour: HOUR_GOLDEN, hourSlow: true, hourLive: false, focus: (cabin && get().placed[cabin.id]) ?? null })
  },
  finishStory: () => {
    set({ phase: 'done', openCard: 'contact', focus: null })
  },
  setHour: (hour) => set({ hour, hourSlow: false, hourLive: false }),
  followClock: () => set({ hour: liveHour(), hourSlow: false, hourLive: true }),
}))

// The pier stands from the start: the ship lands at it before anything else is built.
{
  const placed: Record<string, Placement> = {}
  for (const q of QUESTS) if (q.auto) placed[q.id] = placeLandmark(q)
  useStoryStore.setState({ built: Object.keys(placed), placed })
}

// Resume a saved tour before the first render, and save whenever a landmark is built.
useStoryStore.getState().restore(loadProgress())
useStoryStore.subscribe((s, prev) => {
  if (s.built !== prev.built) saveProgress(s.built)
})

// Dev-only handle for debugging from the browser console.
if (import.meta.env.DEV) (window as unknown as { story: typeof useStoryStore }).story = useStoryStore

/** Whether the landmark of this kind is built (scenery that waits for its tour stop: cabin, falls). */
export function useBuilt(kind: LandmarkKind): boolean {
  return useStoryStore((s) => QUESTS.some((q) => q.landmark === kind && s.built.includes(q.id)))
}

/** The stop the crew is walking to or building right now, or null (sailing in, a card, the ending). */
export function selectActiveQuest(s: Pick<StoryState, 'phase' | 'beat'>) {
  if (!isTourActive(s) || (s.beat.part !== 'walk' && s.beat.part !== 'build')) return null
  return TOUR[s.beat.stop] ?? null
}

/**
 * The scroll tour is running (sailing in and the stops): the page scrolls, the
 * camera follows the story and the toolbar is hidden. The ending and free play
 * come after.
 */
export function isTourActive(s: Pick<StoryState, 'phase'> = useStoryStore.getState()) {
  return s.phase === 'intro' || s.phase === 'questing'
}
