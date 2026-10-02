import { useEffect, useState, type ReactNode } from 'react'
import { selectActiveQuest, useStoryStore } from '../../store/useStoryStore'
import { TOUR } from '../../story/quests'
import { useTouchScreen } from '../../hooks/useTouchScreen'
import { VISITOR } from '../../visitor'
import { PirateAvatar } from './PirateAvatar'
import { bindShipBubble } from './shipBubble'

const GREETING = VISITOR ? `Ahoy, ${VISITOR} crew!` : 'Ahoy!'
const INTRO = `${GREETING} Help us make this island safe to dock. Every landmark you raise shows a piece of its builder’s work.`

const WELCOME_BACK = `${VISITOR ? `Welcome back, ${VISITOR} crew!` : 'Welcome back!'} Your landmarks are still standing. Let’s pick up where we left off.`

const DOCKING = 'Everything’s ready, and look at that sky! Bringing her in to dock...'

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
 * The captain's speech: intro, current task, praise and docking (silent once docked;
 * the HUD's Get in touch takes over). The intro and the
 * praise move on by themselves (useTourDirector); tasks are one click on the glow.
 * `ship` floats beside the ship (wide screens); `toolbar` sits above the tools (phones).
 * Both are mounted and each renders only where it belongs.
 */
export function Dialogue({ placement }: { placement: 'ship' | 'toolbar' }) {
  const beside = useBesideShip()
  const phase = useStoryStore((s) => s.phase)
  const shipState = useStoryStore((s) => s.shipState)
  const questIndex = useStoryStore((s) => s.questIndex)
  const lastDone = useStoryStore((s) => s.lastDone)
  const quest = useStoryStore(selectActiveQuest)
  const building = useStoryStore((s) => s.building)
  const cardOpen = useStoryStore((s) => s.openCard !== null)
  const { startQuests } = useStoryStore.getState()
  const touch = useTouchScreen()

  let line: string
  let key: string
  let actions: ReactNode
  let step: string | null = null

  // A card is the focus: the tour's cards carry the captain's line themselves.
  if (cardOpen) {
    return null
  } else if (phase === 'intro') {
    // Wait until the ship is anchored before the captain speaks.
    if (shipState === 'arriving') return null
    line = questIndex > 0 ? WELCOME_BACK : INTRO
    key = 'intro'
    actions = (
      <button className="dlg-btn primary" onClick={startQuests}>
        Let’s go →
      </button>
    )
  } else if (lastDone) {
    // Flying home after Continue: the next task appears in a moment.
    return null
  } else if (quest) {
    line = quest.dialogue
    key = `quest-${quest.id}`
    step = `${questIndex + 1} of ${TOUR.length}`
    actions = (
      <>
        <span className="dlg-cue">
          {building ? 'Building…' : `👆 ${touch ? 'Tap' : 'Click'} the glowing spot`}
        </span>
      </>
    )
  } else if (phase === 'ending') {
    line = DOCKING
    key = 'docking'
    actions = null
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
        {actions && <div className="dlg-actions">{actions}</div>}
      </div>
    </div>
  )
  return placement === 'ship' ? (
    <div className="dlg-ship" ref={bindShipBubble}>
      {box}
    </div>
  ) : (
    box
  )
}
