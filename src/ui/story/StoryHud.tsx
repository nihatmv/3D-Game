import { useEffect } from 'react'
import { useStoryStore } from '../../store/useStoryStore'
import { TOUR } from '../../story/quests'
import { track, trackThenGo } from '../../analytics'
import { clearProgress } from '../../story/progress'
import { PORTFOLIO_PATH } from '../../routes'
import { withVisitor } from '../../visitor'
import { ProjectCard } from './ProjectCard'
import { TimeOfDay } from './TimeOfDay'
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

const portfolioHref = withVisitor(PORTFOLIO_PATH)

/** Progress counter, the always-on Portfolio link, the time-of-day timeline, the skip link (Get in touch once docked) and the overlays. Both links open the plain page. */
export function StoryHud() {
  useEscToClose()
  const built = useStoryStore((s) => s.built)
  const phase = useStoryStore((s) => s.phase)
  const autoBuild = useStoryStore((s) => s.autoBuild)
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
        <a className="story-btn" href={portfolioHref}>
          📜 Portfolio
        </a>
        {stops > 0 && (
          <button
            className="story-btn story-restart"
            title="Restart the tour"
            aria-label="Restart the tour"
            onClick={() => {
              clearProgress()
              location.reload()
            }}
          >
            <span>
              ↺<span className="story-long"> Restart</span>
            </span>
          </button>
        )}
      </div>

      <TimeOfDay />

      {finished ? (
        <div className="story-skip">
          <button className="story-btn primary" onClick={() => useStoryStore.getState().openProject('contact')}>
            ✉️ Get in touch
          </button>
        </div>
      ) : (
        <div className="story-skip">
          <button
            className="story-btn"
            disabled={autoBuild}
            onClick={() => {
              track('build_all_clicked')
              useStoryStore.getState().buildAll()
            }}
          >
            {autoBuild ? '⚡ Building…' : '⚡ Build it all'}
          </button>
          <a
            className="story-btn"
            href={portfolioHref}
            onClick={(e) => {
              e.preventDefault()
              trackThenGo('skip_clicked', portfolioHref)
            }}
          >
            <span>
              Skip<span className="story-long">, just show me everything</span> →
            </span>
          </a>
        </div>
      )}

      <ProjectCard />
    </>
  )
}
