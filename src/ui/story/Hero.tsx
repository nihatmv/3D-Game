import { useEffect, useState } from 'react'
import { CONTACT } from '../../story/projects'

/** Pixels of scrolling after which the hero gets out of the way. */
const AWAY_PX = 24

/**
 * Top of the page: whose island this is, and that scrolling is how you sail in.
 * Fades out as soon as the visitor scrolls, and comes back at the top.
 */
export function Hero() {
  const [away, setAway] = useState(() => window.scrollY > AWAY_PX)
  useEffect(() => {
    const onScroll = () => setAway(window.scrollY > AWAY_PX)
    // A returning visitor's page opens further down, before this listens.
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`hero${away ? ' away' : ''}`} aria-hidden={away}>
      <h1>{CONTACT.name}</h1>
      <p className="hero-role">{CONTACT.role}</p>
      <p className="hero-hint">
        Scroll to sail in <span aria-hidden>↓</span>
      </p>
    </header>
  )
}
