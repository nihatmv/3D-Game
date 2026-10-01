import { useEffect, useState } from 'react'

const QUERY = '(hover: none) and (pointer: coarse)'

/** True on phones and tablets (no hover, finger input). Follows changes, e.g. a docked tablet. */
export function useTouchScreen() {
  const [touch, setTouch] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setTouch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return touch
}
