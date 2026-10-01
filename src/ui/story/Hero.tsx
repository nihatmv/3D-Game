import { useStoryStore } from '../../store/useStoryStore'
import { CONTACT } from '../../story/projects'

/**
 * Name and one-line pitch over the scene on load, so visitors know whose
 * island this is within seconds. Fades out when the first task starts.
 */
export function Hero() {
  const intro = useStoryStore((s) => s.phase === 'intro')
  return (
    <header className={`hero${intro ? '' : ' gone'}`} aria-hidden={!intro}>
      <h1 className="hero-name">{CONTACT.name}</h1>
      <p className="hero-role">{CONTACT.role}</p>
      <p className="hero-pitch">{CONTACT.pitch}</p>
    </header>
  )
}
