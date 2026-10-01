import { useEffect } from 'react'
import { loadBreathing, loadCommit, playCue, useDemoStore } from '../../story/demos'
import { timeAgo } from '../../story/githubCommit'
import type { Demo } from '../../story/projects'

/** The project's mini demo inside its card (see `Demo` in projects.ts). */
export function ProjectDemo({ demo }: { demo?: Demo }) {
  switch (demo?.kind) {
    case 'commit':
      return <CommitDemo />
    case 'breathing':
      return <BreathingDemo />
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

const WAVE_W = 300
const WAVE_H = 44

/** Polyline points for one pass of the samples across WAVE_W. */
function wavePoints(samples: number[], x0: number): string {
  const step = WAVE_W / samples.length
  return samples.map((v, k) => `${(x0 + k * step).toFixed(1)},${(WAVE_H - 4 - v * (WAVE_H - 8)).toFixed(1)}`).join(' ')
}

/** The sample waveform scrolling by: two copies side by side, slid with a CSS transform. */
function BreathingDemo() {
  const breathing = useDemoStore((s) => s.breathing)
  useEffect(loadBreathing, [])
  if (!breathing) return null
  const { samples, bpm, seconds } = breathing
  return (
    <div className="pf-demo">
      <div className="pf-demo-kicker">
        <span className="lm-dot live" />
        Breathing · {bpm} breaths/min
      </div>
      <div className="pf-wave">
        <svg viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none" aria-label="Breathing waveform">
          <g className="pf-wave-track" style={{ animationDuration: `${seconds}s` }}>
            <polyline points={wavePoints(samples, 0)} />
            <polyline points={wavePoints(samples, WAVE_W)} />
          </g>
        </svg>
      </div>
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
