import { useEffect } from 'react'
import { isTourActive, useStoryStore } from '../../store/useStoryStore'
import { projectById } from '../../story/projects'
import { TOUR } from '../../story/quests'
import { jumpToStop } from '../../story/scroll'
import { STOPS, stopOfCard } from '../../story/timeline'
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

/**
 * Progress dots (each jumps to its stop; in free play it opens the stop's
 * card), Restart, Skip (jumps to the end, which builds the whole island at
 * once), free play's time-of-day timeline and Get in touch, and the cards.
 */
export function StoryHud() {
  useEscToClose()
  const built = useStoryStore((s) => s.built)
  const touring = useStoryStore((s) => isTourActive(s))
  const here = useStoryStore((s) => (isTourActive(s) ? s.beat.stop : -1))
  const atEnd = useStoryStore((s) => s.beat.part === 'contact')
  const stops = TOUR.filter((q) => built.includes(q.id)).length

  const goTo = (stop: number) => {
    const story = useStoryStore.getState()
    const q = TOUR[stop]
    if (isTourActive(story)) jumpToStop(stopOfCard(stop))
    else if (q.projectId) story.openProject(q.projectId, story.placed[q.id])
  }

  return (
    <>
      <div className="story-hud">
        <div className="story-progress">
          <span className="story-dots">
            {TOUR.map((q, stop) => {
              const title = (q.projectId && projectById(q.projectId)?.title) || q.id
              return (
                <button
                  key={q.id}
                  className={`${built.includes(q.id) ? 'on' : ''}${stop === here ? ' here' : ''}`}
                  title={title}
                  aria-label={`Go to ${title}`}
                  onClick={() => goTo(stop)}
                />
              )
            })}
          </span>
          <span aria-label={`${stops} of ${TOUR.length} landmarks built`}>
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

      {!touring && <TimeOfDay />}

      {!touring ? (
        <div className="story-skip">
          <button className="story-btn primary" onClick={() => useStoryStore.getState().openProject('contact')}>
            ✉️ Get in touch
          </button>
        </div>
      ) : (
        !atEnd && (
          <div className="story-skip">
            <button
              className="story-btn"
              onClick={() => {
                track('skip_clicked')
                jumpToStop(STOPS.length - 1)
              }}
            >
              <span>
                Skip<span className="story-long">, just show me everything</span> →
              </span>
            </button>
          </div>
        )
      )}

      <StopCard />
      <ProjectCard />
    </>
  )
}
