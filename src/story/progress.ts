import { TOUR } from './quests'

/**
 * Tour progress kept in localStorage, so a visitor who leaves and comes back
 * resumes where they left off. Only the built tour stops are saved: the island
 * rebuilds from them (placeLandmark), and free-play edits are not kept.
 */
const KEY = 'island-progress'
const VERSION = 1

/** The saved stops, in tour order, as far as they run unbroken (quests are done in order). */
export function loadProgress(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const save = JSON.parse(raw) as { v?: number; built?: unknown }
    if (save.v !== VERSION || !Array.isArray(save.built)) return []
    const ids: string[] = []
    for (const q of TOUR) {
      if (!save.built.includes(q.id)) break
      ids.push(q.id)
    }
    return ids
  } catch {
    return []
  }
}

export function saveProgress(built: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, built: built.filter((id) => TOUR.some((q) => q.id === id)) }))
  } catch {
    // Storage blocked (private mode): the tour just starts fresh next time.
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing saved, nothing to clear.
  }
}
