import { useEffect, useLayoutEffect, useState } from 'react'
import { isTourActive, useStoryStore } from '../../store/useStoryStore'
import { jumpScroll, watchScroll } from '../../story/scroll'
import { SCREENS, segmentOf } from '../../story/timeline'

/**
 * The page's length: an empty block the visitor scrolls through while the
 * island stays fixed behind it (story/scroll.ts turns the position into story
 * progress). Scrolling is on for the tour and off in free play, where the
 * wheel and fingers belong to the camera and tools.
 */
export function ScrollTrack() {
  const touring = useStoryStore((s) => isTourActive(s))
  // In pixels, and remeasured only when the width changes (a rotated phone): a
  // phone's address bar sliding away mid-scroll must not stretch the story.
  const [screen, setScreen] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () =>
      setScreen((s) => (s.w === window.innerWidth ? s : { w: window.innerWidth, h: window.innerHeight }))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    history.scrollRestoration = 'manual'
    // A returning visitor picks up at the card of the last stop they built (at the end, if that was all of them).
    const { questIndex, phase } = useStoryStore.getState()
    const card = questIndex > 0 ? segmentOf('card', questIndex - 1) : null
    jumpScroll(phase === 'done' ? 1 : card ? (card.from + card.to) / 2 : 0)
    return watchScroll()
  }, [])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('scroll-mode', touring)
  }, [touring])

  return <div className="scroll-track" style={{ height: Math.round((SCREENS + 1) * screen.h) }} aria-hidden />
}
