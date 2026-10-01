import { useEffect } from 'react'
import { useStoryStore } from '../../store/useStoryStore'
import { TOUR } from '../../story/quests'
import { PORTFOLIO_PATH } from '../../routes'
import { Hero } from './Hero'
import { ProjectCard } from './ProjectCard'
import './Story.css'

/** Esc closes the open card (in the tour, that's Continue). */
function useEscToClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useStoryStore.getState().openCard) useStoryStore.getState().closeCard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Progress counter, the always-on Portfolio link, the skip link and the overlays. Both links open the plain page. */
export function StoryHud() {
  useEscToClose()
  const built = useStoryStore((s) => s.built)
  const phase = useStoryStore((s) => s.phase)
  const finished = phase === 'ending' || phase === 'done'
  const stops = TOUR.filter((q) => built.includes(q.id)).length

  return (
    <>
      <div className="story-hud">
        <div className="story-progress" aria-label={`${stops} of ${TOUR.length} landmarks built`}>
          <span className="story-dots" aria-hidden>
            {TOUR.map((q) => (
              <span key={q.id} className={built.includes(q.id) ? 'on' : ''} />
            ))}
          </span>
          <span>
            {stops} / {TOUR.length} landmarks
          </span>
        </div>
        <a className="story-btn" href={PORTFOLIO_PATH}>
          📜 Portfolio
        </a>
      </div>

      {!finished && (
        <a className="story-btn story-skip" href={PORTFOLIO_PATH}>
          Skip, just show me everything →
        </a>
      )}

      <Hero />
      <ProjectCard />
    </>
  )
}
