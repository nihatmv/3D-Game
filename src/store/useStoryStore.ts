import { create } from 'zustand'
import { QUESTS, TOUR } from '../story/quests'
import { placeLandmark, type Placement } from '../story/landmarks'
import { track } from '../analytics'
import { loadProgress, saveProgress } from '../story/progress'
import { HOUR_GOLDEN, liveHour } from '../scene/timeOfDay'

export type StoryPhase = 'intro' | 'questing' | 'ending' | 'done'
export type ShipState = 'arriving' | 'waiting' | 'docking' | 'docked'
/** A project id, or 'contact' for the final card. */
export type CardId = string

type StoryState = {
  phase: StoryPhase
  /** Index into TOUR of the active stop (TOUR.length once all are done). */
  questIndex: number
  /** The one-click build for the active quest is playing (see questBuild.ts). */
  building: boolean
  /** "Build it all": useTourDirector plays the remaining stops by itself, briefly showing each card. */
  autoBuild: boolean
  /** Ids of quests whose landmark is built. */
  built: string[]
  /** Where each built quest's landmark stands. */
  placed: Record<string, Placement>
  /** Quest just finished: the captain says its doneLine until the visitor moves on. */
  lastDone: string | null
  /** Card currently shown, or null. */
  openCard: CardId | null
  /** Landmark the camera flies to while its card is open (CameraRig), or null for the home view. */
  focus: Placement | null
  shipState: ShipState
  /** Time of day (hours) that <Lighting/> eases toward; the HUD's timeline sets it. */
  hour: number
  /** Follow the visitor's clock. Dragging the timeline or the ending's sunset stops it. */
  hourLive: boolean
  /** Ease slowly into `hour` (the ending's sunset) instead of following the timeline. */
  hourSlow: boolean

  startQuests: () => void
  setBuilding: (building: boolean) => void
  /** Mark the active quest built, show its card and move on. */
  completeQuest: (id: string) => void
  /** Dismiss the captain's "well done" line and show the next task. */
  clearLastDone: () => void
  /** Build the active quest's landmark without doing the task. */
  skipStep: () => void
  /** Build everything at once and go to the ending (dev and tests). */
  skipAll: () => void
  /** The HUD's "Build it all": play the remaining stops one by one, hands-free (useTourDirector). */
  buildAll: () => void
  /** Rebuild saved tour stops on load (progress.ts). Partial: the intro plays, then the next stop. All: the ending. */
  restore: (ids: string[]) => void
  /** Open a card; with `at`, the camera flies to that landmark too. */
  openProject: (id: CardId, at?: Placement) => void
  /** Close the card and fly home. In the tour this is "Continue": useTourDirector then shows the next task. */
  closeCard: () => void
  setShipState: (s: ShipState) => void
  /** The tour is done: build the `auto` landmarks (the pier) and sail in as the sun goes down. */
  startDocking: () => void
  /** The ship is tied up: the story is over, show who built the island. */
  finishStory: () => void
  setHour: (hour: number) => void
  /** Go back to the visitor's clock, or catch up with it (called every minute). */
  followClock: () => void
}

export const useStoryStore = create<StoryState>((set, get) => ({
  phase: 'intro',
  questIndex: 0,
  building: false,
  autoBuild: false,
  built: [],
  placed: {},
  lastDone: null,
  openCard: null,
  focus: null,
  shipState: 'arriving',
  hour: liveHour(),
  hourLive: true,
  hourSlow: false,

  startQuests: () => {
    if (get().phase !== 'intro') return
    set({ phase: 'questing' })
    track('tour_started')
  },

  setBuilding: (building) => set({ building }),

  completeQuest: (id) => {
    const { questIndex, built } = get()
    const q = TOUR[questIndex]
    if (!q || q.id !== id || built.includes(id)) return
    const next = questIndex + 1
    // Advance first: placing the landmark edits the island, which re-runs the quest watcher.
    set({
      built: [...built, id],
      lastDone: id,
      questIndex: next,
      building: false,
      openCard: q.projectId,
      phase: next >= TOUR.length ? 'ending' : 'questing',
    })
    track('landmark_completed', { project: q.projectId, stop: next })
    const at = placeLandmark(q)
    set({ placed: { ...get().placed, [id]: at }, focus: at })
  },

  clearLastDone: () => set({ lastDone: null }),

  skipStep: () => {
    const q = TOUR[get().questIndex]
    if (q) get().completeQuest(q.id)
  },

  skipAll: () => {
    set({
      built: QUESTS.map((q) => q.id),
      questIndex: TOUR.length,
      building: false,
      phase: 'ending',
      lastDone: null,
      openCard: null,
      focus: null,
    })
    // Place every landmark still missing, in order (the lighthouse top needs its base).
    const placed = { ...get().placed }
    for (const q of QUESTS) if (!placed[q.id]) placed[q.id] = placeLandmark(q)
    set({ placed })
  },

  buildAll: () => {
    if (get().phase === 'intro' || get().phase === 'questing') set({ autoBuild: true })
  },

  restore: (ids) => {
    if (!ids.length) return
    // Story state first: placing landmarks edits the island, which re-runs the quest watcher.
    set({
      built: ids,
      questIndex: ids.length,
      phase: ids.length >= TOUR.length ? 'ending' : 'intro',
      lastDone: null,
      openCard: null,
      focus: null,
    })
    const placed: Record<string, Placement> = {}
    for (const q of TOUR) if (ids.includes(q.id)) placed[q.id] = placeLandmark(q)
    set({ placed })
  },

  openProject: (id, at) => set({ openCard: id, focus: at ?? null }),
  closeCard: () => set({ openCard: null, focus: null }),
  setShipState: (shipState) => set({ shipState }),
  startDocking: () => {
    const { shipState, built } = get()
    if (shipState !== 'waiting') return
    // Placing edits the island; that's safe here, as no quest is active in the ending.
    const placed = { ...get().placed }
    const missing = QUESTS.filter((q) => !placed[q.id])
    for (const q of missing) placed[q.id] = placeLandmark(q)
    // One update (and no re-entry from the ending director), and the ship sees the pier when it plots its course.
    set({
      built: [...built, ...missing.map((q) => q.id).filter((id) => !built.includes(id))],
      placed,
      shipState: 'docking',
      hour: HOUR_GOLDEN,
      hourSlow: true,
      hourLive: false,
    })
  },
  finishStory: () => {
    set({ phase: 'done', openCard: 'contact', focus: null })
  },
  setHour: (hour) => set({ hour, hourSlow: false, hourLive: false }),
  followClock: () => set({ hour: liveHour(), hourSlow: false, hourLive: true }),
}))

// Resume a saved tour before the first render, and save whenever a landmark is built.
useStoryStore.getState().restore(loadProgress())
useStoryStore.subscribe((s, prev) => {
  if (s.built !== prev.built) saveProgress(s.built)
})

// Dev-only handle for debugging from the browser console.
if (import.meta.env.DEV) (window as unknown as { story: typeof useStoryStore }).story = useStoryStore

/**
 * The quest the visitor is working on right now, or null (intro, ending, or
 * while the captain is still praising the last landmark).
 */
export function selectActiveQuest(s: Pick<StoryState, 'phase' | 'questIndex' | 'lastDone'>) {
  if (s.phase !== 'questing' || s.lastDone) return null
  return TOUR[s.questIndex] ?? null
}

/**
 * The only tool the visitor may use right now: the current quest's tool from
 * the intro until the last quest is done (including the captain's "well done"
 * pause, which locks to the next task's tool). Null once the island is free play.
 */
export function selectToolLock(s: Pick<StoryState, 'phase' | 'questIndex'>) {
  if (s.phase !== 'intro' && s.phase !== 'questing') return null
  return TOUR[s.questIndex]?.tool ?? null
}

/**
 * The guided tour is running (intro, tour stops, and the last stop's card): the
 * camera is locked, the toolbar is hidden and only the glowing target builds.
 * Free play comes after.
 */
export function isTourActive(s: Pick<StoryState, 'phase' | 'lastDone'> = useStoryStore.getState()) {
  return s.phase === 'intro' || s.phase === 'questing' || (s.phase === 'ending' && s.lastDone !== null)
}
