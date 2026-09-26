import { wake } from './perf'

/**
 * Tiny event queue for particle puffs. Anything can call `emit`; the
 * <Particles/> component drains the queue each frame. No React state involved.
 */

export type PuffKind = 'dirt' | 'splash' | 'dust' | 'leaves' | 'fizzle'

export type PuffConfig = {
  colors: string[]
  count: number
  /** Initial upward speed range. */
  up: [number, number]
  /** Horizontal speed. */
  spread: number
  gravity: number
  life: [number, number]
  size: [number, number]
}

export const PUFFS: Record<PuffKind, PuffConfig> = {
  dirt: { colors: ['#8a6445', '#a47a52', '#b98a5e', '#9fd28a'], count: 10, up: [1.6, 2.6], spread: 1.3, gravity: 7, life: [0.5, 0.8], size: [0.06, 0.11] },
  splash: { colors: ['#f2fcfa', '#a8e8e2', '#6fd6d0'], count: 12, up: [2.2, 3.4], spread: 1.1, gravity: 10, life: [0.45, 0.7], size: [0.05, 0.09] },
  dust: { colors: ['#e2ddd6', '#c9c4bd', '#b8b2aa'], count: 9, up: [0.5, 1.1], spread: 1.0, gravity: -0.4, life: [0.6, 0.9], size: [0.07, 0.13] },
  leaves: { colors: ['#8fcf73', '#a6d98a', '#6fae63', '#f7a8c4'], count: 6, up: [1.0, 1.9], spread: 1.1, gravity: 4, life: [0.6, 0.9], size: [0.04, 0.07] },
  fizzle: { colors: ['#c9c4bd', '#b8b2aa'], count: 3, up: [0.4, 0.8], spread: 0.5, gravity: 1, life: [0.3, 0.45], size: [0.03, 0.05] },
}

export type Emit = { kind: PuffKind; x: number; y: number; z: number; count?: number }

const queue: Emit[] = []

export function emit(kind: PuffKind, x: number, y: number, z: number, count?: number) {
  queue.push({ kind, x, y, z, count })
  wake(1200)
}

export function drainEmits(): Emit[] {
  return queue.splice(0, queue.length)
}
