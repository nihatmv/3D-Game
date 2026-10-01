import { useEffect } from 'react'
import { useStoryStore } from '../../store/useStoryStore'
import { TOUR } from '../../story/quests'
import { Hero } from './Hero'
import { PortfolioPanel } from './PortfolioPanel'
import { ProjectCard } from './ProjectCard'
import './Story.css'

/** Esc closes the top-most overlay: the card first, then the list. */
function useEscToClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useStoryStore.getState()
      if (s.openCard) s.closeCard()
      else if (s.portfolioOpen) s.setPortfolioOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Progress counter, the always-on Portfolio button, the skip button and the overlays. */
export function StoryHud() {
  useEscToClose()
  const built = useStoryStore((s) => s.built)
  const phase = useStoryStore((s) => s.phase)
  const portfolioOpen = useStoryStore((s) => s.portfolioOpen)
  const setPortfolioOpen = useStoryStore((s) => s.setPortfolioOpen)
  const skipAll = useStoryStore((s) => s.skipAll)
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
        <button className="story-btn" onClick={() => setPortfolioOpen(!portfolioOpen)} aria-pressed={portfolioOpen}>
          📜 Portfolio
        </button>
      </div>

      {!finished && (
        <button className="story-btn story-skip" onClick={skipAll}>
          Skip, just show me everything →
        </button>
      )}

      <Hero />
      <PortfolioPanel />
      <ProjectCard />
    </>
  )
}
