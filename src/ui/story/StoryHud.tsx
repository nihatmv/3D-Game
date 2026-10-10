import { useEffect } from 'react'
import { useStoryStore } from '../../store/useStoryStore'
import { TOUR } from '../../story/quests'
import { jumpScroll } from '../../story/scroll'
import { segmentOf } from '../../story/timeline'
import { track } from '../../analytics'
import { clearProgress } from '../../story/progress'
import { ProjectCard } from './ProjectCard'
import { StopCard } from './StopCard'
import { TimeOfDay } from './TimeOfDay'
import './Story.css'

/** Esc closes the open full card. */
function useEscToClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useStoryStore.getState().openCard) useStoryStore.getState().closeCard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Progress counter, the time-of-day timeline, Skip (Get in touch once the tour is over) and the cards. Skip scrolls to the end, which builds the whole island at once. */
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
            onClick={() => {
              track('skip_clicked')
              jumpScroll(segmentOf('sunset').to)
            }}
          >
            <span>
              Skip<span className="story-long">, just show me everything</span> →
            </span>
          </button>
        </div>
      )}

      <StopCard />
      <ProjectCard />
    </>
  )
}
