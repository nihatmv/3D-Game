import { useEffect, useState } from 'react'
import { useIslandStore, type Tool } from '../store/useIslandStore'
import { selectActiveQuest, selectToolLock, useStoryStore } from '../store/useStoryStore'
import { useToolHotkeys } from '../hooks/useToolHotkeys'
import { useTouchScreen } from '../hooks/useTouchScreen'
import { ToolIcon } from './ToolIcons'
import { Dialogue } from './story/Dialogue'
import './Toolbar.css'

type ToolDef = { id: Tool; key: string; label: string; hint: string; tapHint: string; removeHint: string }

const TOOLS: ToolDef[] = [
  { id: 'soil', key: '1', label: 'Soil', hint: 'Click or drag to raise land', tapHint: 'Tap to raise land', removeHint: 'Lowering land' },
  {
    id: 'stone',
    key: '2',
    label: 'Stone',
    hint: 'Click for a boulder, keep clicking to build a tower',
    tapHint: 'Tap for a boulder, tap again to stack',
    removeHint: 'Removing the top stone',
  },
  { id: 'water', key: '3', label: 'Water', hint: 'Click or drag to dig a pond', tapHint: 'Tap to dig a pond', removeHint: 'Filling ponds back in' },
  { id: 'seeds', key: '4', label: 'Seeds', hint: 'Click or drag to scatter seeds', tapHint: 'Tap to scatter seeds', removeHint: 'Clearing plants' },
]

/** Tracks the Shift key for the "remove mode" hint. */
function useShiftHeld() {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const on = (e: KeyboardEvent) => setHeld(e.shiftKey)
    const off = () => setHeld(false)
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', on)
      window.removeEventListener('blur', off)
    }
  }, [])
  return held
}

export function Toolbar() {
  useToolHotkeys()
  const tool = useIslandStore((s) => s.tool)
  const setTool = useIslandStore((s) => s.setTool)
  const erase = useIslandStore((s) => s.erase)
  const setErase = useIslandStore((s) => s.setErase)
  const touch = useTouchScreen()
  const removing = useShiftHeld() || (touch && erase)
  const active = TOOLS.find((t) => t.id === tool)!
  const questTool = useStoryStore((s) => selectActiveQuest(s)?.tool)
  // During the quests only the task's tool works; the rest unlock for free play after.
  const lock = useStoryStore(selectToolLock)

  return (
    <div className={`toolbar-wrap${touch ? ' touch' : ''}`}>
      <Dialogue placement="toolbar" />
      <div className={`toolbar-hint${removing ? ' remove' : ''}`} key={`${tool}-${removing}`}>
        {removing ? active.removeHint : touch ? active.tapHint : active.hint}
        {!removing && <span className="toolbar-hint-sub">{touch ? ' · two fingers to turn' : ' · hold Shift to undo'}</span>}
      </div>
      <div className="toolbar" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool tool-${t.id}${t.id === tool ? ' active' : ''}${t.id === questTool && t.id !== tool ? ' quest-pulse' : ''}`}
            onClick={() => setTool(t.id)}
            disabled={!!lock && t.id !== lock}
            title={lock && t.id !== lock ? `${t.label}: the captain needs ${lock} for this task` : `${t.label} (${t.key})`}
            aria-pressed={t.id === tool}
          >
            <span className="tool-icon">
              <ToolIcon tool={t.id} />
            </span>
            <span className="tool-label">{t.label}</span>
            {!touch && <span className="tool-key">{t.key}</span>}
          </button>
        ))}
        {/* Phones have no Shift key: this toggle makes every tool undo instead. */}
        {touch && (
          <button className={`tool tool-erase${erase ? ' active' : ''}`} onClick={() => setErase(!erase)} aria-pressed={erase}>
            <span className="tool-icon" aria-hidden>
              <EraseIcon />
            </span>
            <span className="tool-label">Remove</span>
          </button>
        )}
      </div>
      {!touch && <div className="toolbar-sub">Right-drag to orbit · Middle-drag to pan · Scroll to zoom</div>}
    </div>
  )
}

function EraseIcon() {
  return (
    <svg viewBox="0 0 32 32">
      <path d="M6 20.5 17.5 9a3 3 0 0 1 4.2 0l3.3 3.3a3 3 0 0 1 0 4.2L16 25.5h-6.2L6 21.7Z" fill="#f4a3a0" />
      <path d="M6 20.5 11.2 15.3 18.7 22.8 16 25.5h-6.2L6 21.7Z" fill="#fff3ec" />
      <path d="M14 25.5h12" stroke="#b9876a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
