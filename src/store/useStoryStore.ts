import { create } from 'zustand'
import { QUESTS, TOUR } from '../story/quests'
import { placeLandmark, type Placement } from '../story/landmarks'

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
  /** Ids of quests whose landmark is built. */
  built: string[]
  /** Where each built quest's landmark stands. */
  placed: Record<string, Placement>
  /** Quest just finished: the captain says its doneLine until the visitor moves on. */
  lastDone: string | null
  /** Card currently shown, or null. */
  openCard: CardId | null
  /** The plain list view of the whole portfolio. */
  portfolioOpen: boolean
  shipState: ShipState
  /** Sunset tween target: 0 = day, 1 = golden hour. */
  sunset: number

  startQuests: () => void
  setBuilding: (building: boolean) => void
  /** Mark the active quest built, show its card and move on. */
  completeQuest: (id: string) => void
  /** Dismiss the captain's "well done" line and show the next task. */
  clearLastDone: () => void
  /** Build the active quest's landmark without doing the task. */
  skipStep: () => void
  /** Build everything, go to the ending and show the full portfolio. */
  skipAll: () => void
  openProject: (id: CardId) => void
  closeCard: () => void
  setPortfolioOpen: (open: boolean) => void
  setShipState: (s: ShipState) => void
  /** The tour is done: build the `auto` landmarks (the pier) and sail in as the sun goes down. */
  startDocking: () => void
  /** The ship is tied up: the story is over, show who built the island. */
  finishStory: () => void
}

export const useStoryStore = create<StoryState>((set, get) => ({
  phase: 'intro',
  questIndex: 0,
  building: false,
  built: [],
  placed: {},
  lastDone: null,
  openCard: null,
  portfolioOpen: false,
  shipState: 'arriving',
  sunset: 0,

  startQuests: () => {
    if (get().phase === 'intro') set({ phase: 'questing' })
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
    set({ placed: { ...get().placed, [id]: placeLandmark(q, get().placed) } })
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
      portfolioOpen: true,
    })
    // Place every landmark still missing, in order (the lighthouse top needs its base).
    const placed = { ...get().placed }
    for (const q of QUESTS) if (!placed[q.id]) placed[q.id] = placeLandmark(q, placed)
    set({ placed })
  },

  openProject: (id) => set({ openCard: id }),
  closeCard: () => set({ openCard: null }),
  setPortfolioOpen: (portfolioOpen) => set({ portfolioOpen }),
  setShipState: (shipState) => set({ shipState }),
  startDocking: () => {
    const { shipState, built } = get()
    if (shipState !== 'waiting') return
    // Placing edits the island; that's safe here, as no quest is active in the ending.
    const placed = { ...get().placed }
    const missing = QUESTS.filter((q) => !placed[q.id])
    for (const q of missing) placed[q.id] = placeLandmark(q, placed)
    // One update (and no re-entry from the ending director), and the ship sees the pier when it plots its course.
    set({
      built: [...built, ...missing.map((q) => q.id).filter((id) => !built.includes(id))],
      placed,
      shipState: 'docking',
      sunset: 1,
    })
  },
  finishStory: () => {
    // Skippers already have the full list open, which includes the contact info.
    const { portfolioOpen, openCard } = get()
    set({ phase: 'done', openCard: portfolioOpen ? openCard : 'contact' })
  },
}))

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
 * The guided tour is running (intro or tour stops): the camera is locked, the
 * toolbar is hidden and only the glowing target builds. Free play comes after.
 */
export function isTourActive(s: Pick<StoryState, 'phase'> = useStoryStore.getState()) {
  return s.phase === 'intro' || s.phase === 'questing'
}
