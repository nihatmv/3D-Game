import { useEffect } from 'react'
import { loadCommit, playCue, useDemoStore } from '../../story/demos'
import { timeAgo } from '../../story/githubCommit'
import type { Demo } from '../../story/projects'

/** The project's mini demo inside its card (see `Demo` in projects.ts). */
export function ProjectDemo({ demo }: { demo?: Demo }) {
  switch (demo?.kind) {
    case 'commit':
      return <CommitDemo />
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

function CommitDemo() {
  const commit = useDemoStore((s) => s.commit)
  useEffect(loadCommit, [])
  return (
    <div className="pf-demo">
      <div className="pf-demo-kicker">
        <span className={`lm-dot${commit?.live ? ' live' : ''}`} />
        {commit?.live ? 'Live from GitHub' : 'Latest commit'}
        {commit?.date && ` · ${timeAgo(commit.date)}`}
      </div>
      {commit ? (
        <a className="pf-commit" href={commit.url} target="_blank" rel="noreferrer">
          <span className="pf-commit-repo">{commit.repo}</span>
          <span className="pf-commit-msg">{commit.message}</span>
        </a>
      ) : (
        <p className="pf-commit-msg">Checking GitHub…</p>
      )}
    </div>
  )
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
