import { useEffect, useState } from 'react'
import { useStoryStore } from '../../store/useStoryStore'
import { TOUR } from '../../story/quests'
import { VISITOR } from '../../visitor'
import { PirateAvatar } from './PirateAvatar'
import { bindShipBubble } from './shipBubble'

const GREETING = VISITOR ? `Ahoy, ${VISITOR} crew!` : 'Ahoy!'
const INTRO = `${GREETING} We’ve landed on a bare island. Keep scrolling and we’ll build it up: every landmark we raise shows a piece of its builder’s work.`

const SUNSET = 'The island is finished, and look at that sky!'

/** Screens with room beside the ship for the speech bubble; smaller ones keep it above the toolbar. */
const BESIDE_SHIP = '(min-width: 900px) and (min-height: 501px)'

function useBesideShip() {
  const [beside, setBeside] = useState(() => window.matchMedia(BESIDE_SHIP).matches)
  useEffect(() => {
    const mq = window.matchMedia(BESIDE_SHIP)
    const on = () => setBeside(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return beside
}

/**
 * The captain's speech, picked by where the scroll is: the greeting once the
 * ship has landed, each stop's task while the crew walks there and builds, and
 * the sunset line at the end. Silent while a card is up (it carries his line).
 * `ship` floats beside the ship (wide screens); `toolbar` sits above the tools (phones).
 * Both are mounted and each renders only where it belongs.
 */
export function Dialogue({ placement }: { placement: 'ship' | 'toolbar' }) {
  const beside = useBesideShip()
  const phase = useStoryStore((s) => s.phase)
  const beat = useStoryStore((s) => s.beat)
  const cardOpen = useStoryStore((s) => s.openCard !== null)

  let line: string
  let key: string
  let step: string | null = null
  // At a stop the camera is close on the site: he speaks from where its card will come up, not from the ship.
  let atShip = true

  if (cardOpen || phase === 'done') {
    return null
  } else if (phase === 'ending' || beat.part === 'gather' || beat.part === 'sunset') {
    line = SUNSET
    key = 'sunset'
  } else if (beat.part === 'land') {
    line = INTRO
    key = 'intro'
  } else if ((beat.part === 'walk' || beat.part === 'build') && TOUR[beat.stop]) {
    line = TOUR[beat.stop].dialogue
    key = `quest-${TOUR[beat.stop].id}`
    step = `${beat.stop + 1} of ${TOUR.length}`
    atShip = false
  } else {
    return null
  }
  if (beside !== (placement === 'ship')) return null

  const box = (
    <div className="dlg" role="status" aria-live="polite">
      <div className="dlg-avatar" aria-hidden>
        <PirateAvatar />
      </div>
      <div className="dlg-body" key={key}>
        <div className="dlg-name">
          Captain{step && <span className="dlg-step"> · {step}</span>}
        </div>
        <p className="dlg-line">{line}</p>
      </div>
    </div>
  )
  if (placement !== 'ship') return box
  return atShip ? (
    // Keyed apart: shipBubble styles its wrapper by hand, which must not leak into the other one.
    <div className="dlg-ship" key="ship" ref={bindShipBubble}>
      {box}
    </div>
  ) : (
    <div className="dlg-side" key="side">
      {box}
    </div>
  )
}
