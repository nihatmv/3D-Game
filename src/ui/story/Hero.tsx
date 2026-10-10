import { useStoryStore } from '../../store/useStoryStore'
import { CONTACT } from '../../story/projects'
import { stepBy } from '../../story/scroll'

/**
 * The start of the story: whose island this is, and that scrolling is how you
 * sail in (the hint is a button too). Out of the way once the story has left
 * its first stop, back when the visitor returns to it.
 */
export function Hero() {
  const away = useStoryStore((s) => s.step > 0)

  return (
    <header className={`hero${away ? ' away' : ''}`} aria-hidden={away}>
      <h1>{CONTACT.name}</h1>
      <p className="hero-role">{CONTACT.role}</p>
      <button className="hero-hint" tabIndex={away ? -1 : 0} onClick={() => stepBy(1)}>
        Scroll to sail in <span aria-hidden>↓</span>
      </button>
    </header>
  )
}
