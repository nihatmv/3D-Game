import { create } from 'zustand'
import { QUESTS } from '../story/quests'
import { placeLandmark, type Placement } from '../story/landmarks'

export type StoryPhase = 'intro' | 'questing' | 'ending' | 'done'
export type ShipState = 'arriving' | 'waiting' | 'docking' | 'docked'
/** A project id, or 'contact' for the final card. */
export type CardId = string

type StoryState = {
  phase: StoryPhase
  /** Index into QUESTS of the active quest (QUESTS.length once all are done). */
  questIndex: number
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
  /** Everything is built: sail in to the pier as the sun goes down. */
  startDocking: () => void
  /** The ship is tied up: the story is over, show who built the island. */
  finishStory: () => void
}

export const useStoryStore = create<StoryState>((set, get) => ({
  phase: 'intro',
  questIndex: 0,
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

  completeQuest: (id) => {
    const { questIndex, built } = get()
    const q = QUESTS[questIndex]
    if (!q || q.id !== id || built.includes(id)) return
    const next = questIndex + 1
    // Advance first: placing the landmark edits the island, which re-runs the quest watcher.
    set({
      built: [...built, id],
      lastDone: id,
      questIndex: next,
      openCard: q.projectId,
      phase: next >= QUESTS.length ? 'ending' : 'questing',
    })
    set({ placed: { ...get().placed, [id]: placeLandmark(q, get().placed) } })
  },

  clearLastDone: () => set({ lastDone: null }),

  skipStep: () => {
    const q = QUESTS[get().questIndex]
    if (q) get().completeQuest(q.id)
  },

  skipAll: () => {
    set({
      built: QUESTS.map((q) => q.id),
      questIndex: QUESTS.length,
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
  startDocking: () => set({ shipState: 'docking', sunset: 1 }),
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
  return QUESTS[s.questIndex] ?? null
}
