import { useEffect, useState, type ReactNode } from 'react'
import { useIslandStore } from '../../store/useIslandStore'
import { selectActiveQuest, useStoryStore } from '../../store/useStoryStore'
import { QUESTS } from '../../story/quests'
import { ToolIcon } from '../ToolIcons'
import { PirateAvatar } from './PirateAvatar'
import { bindShipBubble } from './shipBubble'

const INTRO = [
  'Ahoy there! Strange island... nobody’s charted this one.',
  'Help us make it safe to dock? Everything you build tells us a little more about this place.',
]

const DOCKING = 'Everything’s ready, and look at that sky! Bringing her in to dock...'
const DOCKED = 'We made it, just in time for sunset. Thank you, builder! Here’s who charted this island.'

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

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
 * The captain's speech: intro, current task, and praise.
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
  const { startQuests, clearLastDone, skipStep, openProject, setPortfolioOpen } = useStoryStore.getState()
  const tool = useIslandStore((s) => s.tool)
  const setTool = useIslandStore((s) => s.setTool)
  const [introStep, setIntroStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  let line: string
  let key: string
  let actions: ReactNode
  let step: string | null = null

  if (phase === 'intro') {
    // Wait until the ship is anchored before the captain speaks.
    if (shipState === 'arriving') return null
    const last = introStep >= INTRO.length - 1
    line = INTRO[introStep]
    key = `intro-${introStep}`
    actions = (
      <button className="dlg-btn primary" onClick={() => (last ? startQuests() : setIntroStep(introStep + 1))}>
        {last ? 'Let’s build!' : 'Next →'}
      </button>
    )
  } else if (lastDone) {
    const done = QUESTS.find((q) => q.id === lastDone)!
    line = done.doneLine
    key = `done-${lastDone}`
    actions = (
      <button className="dlg-btn primary" onClick={clearLastDone}>
        {phase === 'questing' ? 'Next task →' : 'Great!'}
      </button>
    )
  } else if (quest) {
    line = quest.dialogue
    key = `quest-${quest.id}`
    step = `Task ${questIndex + 1} of ${QUESTS.length}`
    actions = (
      <>
        {tool !== quest.tool && (
          <button className={`dlg-btn tool-chip tool-${quest.tool}`} onClick={() => setTool(quest.tool)}>
            <ToolIcon tool={quest.tool} />
            Use {capitalize(quest.tool)}
          </button>
        )}
        <button className="dlg-btn ghost" onClick={skipStep}>
          Skip this step
        </button>
      </>
    )
  } else if (phase === 'ending') {
    line = DOCKING
    key = 'docking'
    actions = null
  } else if (phase === 'done' && !dismissed) {
    line = DOCKED
    key = 'docked'
    actions = (
      <>
        <button className="dlg-btn ghost" onClick={() => setDismissed(true)}>
          Keep building
        </button>
        <button className="dlg-btn" onClick={() => setPortfolioOpen(true)}>
          All projects
        </button>
        <button className="dlg-btn primary" onClick={() => openProject('contact')}>
          Get in touch
        </button>
      </>
    )
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
