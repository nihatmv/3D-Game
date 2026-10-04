import { playCue, useDemoStore } from '../../story/demos'
import type { Demo } from '../../story/projects'

/** The project's mini demo inside its card (see `Demo` in projects.ts). */
export function ProjectDemo({ demo }: { demo?: Demo }) {
  switch (demo?.kind) {
    case 'song':
      return <SongDemo song={demo.song} />
    case 'milestone':
      return (
        <div className="pf-demo pf-milestone" aria-label={`${demo.from} to ${demo.to}`}>
          <span>{demo.from}</span>
          <span className="pf-milestone-arrow" aria-hidden>
            →
          </span>
          <span className="to">{demo.to}</span>
        </div>
      )
    default:
      return null
  }
}

function SongDemo({ song }: { song: string }) {
  const cue = useDemoStore((s) => s.cue)
  return (
    <div className="pf-demo pf-song">
      <button className="pf-play" onClick={playCue} disabled={cue === 'listening'}>
        {cue === 'listening' ? '🎧 Listening…' : '▶ Play a clip'}
      </button>
      <span className="pf-song-out" aria-live="polite">
        {cue === 'recognized' ? (
          <>
            Recognized: <b>{song}</b>
          </>
        ) : (
          'or click the pond'
        )}
      </span>
    </div>
  )
}
