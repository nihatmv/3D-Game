import { useFrame } from '@react-three/fiber'
import { stepScroll } from '../../story/scroll'
import { stepScrollDirector } from '../../story/scrollDirector'
import { wake } from '../perf'

/**
 * Moves the story's progress on (story/scroll.ts) once per rendered frame,
 * lets the director act on it, and keeps the frame rate up until it has caught
 * up with where the visitor scrolled it. Mounted first in the scene, so everything after it reads this frame's
 * value.
 */
export function ScrollDriver() {
  useFrame((_, rawDt) => {
    if (stepScroll(Math.min(rawDt, 0.25))) wake(200)
    stepScrollDirector()
  })
  return null
}
