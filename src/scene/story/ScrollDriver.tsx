import { useFrame } from '@react-three/fiber'
import { stepScroll } from '../../story/scroll'
import { wake } from '../perf'

/**
 * Eases the story's scroll progress (story/scroll.ts) once per rendered frame
 * and keeps the frame rate up until it has caught up with the page. Mounted
 * first in the scene, so everything after it reads this frame's value.
 */
export function ScrollDriver() {
  useFrame((_, rawDt) => {
    if (stepScroll(Math.min(rawDt, 0.25))) wake(200)
  })
  return null
}
