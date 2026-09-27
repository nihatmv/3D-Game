import { useEffect, useState } from 'react'
import { useIslandStore, type Tool } from '../store/useIslandStore'
import { useToolHotkeys } from '../hooks/useToolHotkeys'
import { ToolIcon } from './ToolIcons'
import './Toolbar.css'

type ToolDef = { id: Tool; key: string; label: string; hint: string; removeHint: string }

const TOOLS: ToolDef[] = [
  { id: 'soil', key: '1', label: 'Soil', hint: 'Click or drag to raise land', removeHint: 'Lowering land' },
  { id: 'stone', key: '2', label: 'Stone', hint: 'Click for a boulder, keep clicking to build a tower', removeHint: 'Removing the top stone' },
  { id: 'water', key: '3', label: 'Water', hint: 'Click or drag to dig a pond', removeHint: 'Filling ponds back in' },
  { id: 'seeds', key: '4', label: 'Seeds', hint: 'Click or drag to scatter seeds', removeHint: 'Clearing plants' },
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
  const shift = useShiftHeld()
  const active = TOOLS.find((t) => t.id === tool)!

  return (
    <div className="toolbar-wrap">
      <div className={`toolbar-hint${shift ? ' remove' : ''}`} key={`${tool}-${shift}`}>
        {shift ? active.removeHint : active.hint}
        {!shift && <span className="toolbar-hint-sub"> · hold Shift to undo</span>}
      </div>
      <div className="toolbar" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool tool-${t.id}${t.id === tool ? ' active' : ''}`}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.key})`}
            aria-pressed={t.id === tool}
          >
            <span className="tool-icon">
              <ToolIcon tool={t.id} />
            </span>
            <span className="tool-label">{t.label}</span>
            <span className="tool-key">{t.key}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-sub">Right-drag to orbit · Middle-drag to pan · Scroll to zoom</div>
    </div>
  )
}
