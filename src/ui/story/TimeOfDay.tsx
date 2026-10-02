import { useEffect, useRef, useState } from 'react'
import { useStoryStore } from '../../store/useStoryStore'
import { HOUR_GOLDEN, HOUR_MAX, HOUR_MIN, KEYS, clockHour } from '../../scene/timeOfDay'
import { track } from '../../analytics'

const span = HOUR_MAX - HOUR_MIN
const pct = (h: number) => ((h - HOUR_MIN) / span) * 100
const TRACK = `linear-gradient(90deg, ${KEYS.map((k) => `${k.ui} ${pct(k.hour).toFixed(1)}%`).join(', ')})`
const TICKS = [
  { hour: 6.5, label: 'Dawn' },
  { hour: 12, label: 'Noon' },
  { hour: HOUR_GOLDEN, label: 'Sunset' },
  { hour: 22, label: 'Night' },
]

/** "6:30 pm", rounded to five minutes. */
function clock(hour: number) {
  const mins = Math.round((hour * 60) / 5) * 5
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

const isNight = (h: number) => h < 6 || h >= 20

/** While live, keep up with the visitor's clock (checked once a minute; the sky barely moves in that time). */
function useClock(live: boolean) {
  const [now, setNow] = useState(clockHour)
  useEffect(() => {
    if (!live) return
    const tick = () => {
      setNow(clockHour())
      useStoryStore.getState().followClock()
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [live])
  return now
}

/**
 * The horizontal time-of-day timeline at the top. It starts at the visitor's
 * own time and follows it; dragging takes over, and the clock label (now ↺)
 * brings it back.
 */
export function TimeOfDay() {
  const hour = useStoryStore((s) => s.hour)
  const live = useStoryStore((s) => s.hourLive)
  const now = useClock(live)
  const tracked = useRef(false)
  const p = (hour - HOUR_MIN) / span
  // Live, the label is the real time (the knob rests at a night end in the small hours).
  const label = live ? clock(now) : clock(hour)

  return (
    <div className="tod">
      <button
        className={`tod-time${live ? ' live' : ''}`}
        disabled={live}
        title={live ? 'Your local time' : 'Back to your local time'}
        aria-label={live ? `Following your local time, ${label}` : 'Back to your local time'}
        onClick={() => useStoryStore.getState().followClock()}
      >
        <span className="tod-dot" aria-hidden />
        {live ? label : `↺ ${label}`}
      </button>
      <div className="tod-bar">
        <div className="tod-track" style={{ background: TRACK }} />
        <div className="tod-rail" aria-hidden>
          <div className="tod-knob" style={{ transform: `translateX(${(p * 100).toFixed(2)}%)` }}>
            <span className="tod-thumb">{isNight(hour) ? '🌙' : '☀️'}</span>
          </div>
        </div>
        <input
          className="tod-input"
          type="range"
          min={HOUR_MIN}
          max={HOUR_MAX}
          step={0.05}
          value={hour}
          aria-label="Time of day"
          aria-valuetext={label}
          onChange={(e) => {
            useStoryStore.getState().setHour(Number(e.target.value))
            if (!tracked.current) {
              tracked.current = true
              track('time_changed')
            }
          }}
        />
        <div className="tod-ticks" aria-hidden>
          {TICKS.map((t) => (
            <span key={t.label} style={{ left: `calc(var(--tod-knob) / 2 + (100% - var(--tod-knob)) * ${(pct(t.hour) / 100).toFixed(3)})` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
