import { useEffect } from 'react'
import { useIslandStore, type Tool } from '../store/useIslandStore'

export const TOOL_KEYS: Record<string, Tool> = { '1': 'soil', '2': 'stone', '3': 'water', '4': 'seeds' }

/** Number keys 1–4 select tools. */
export function useToolHotkeys() {
  const setTool = useIslandStore((s) => s.setTool)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const tool = TOOL_KEYS[e.key]
      if (tool) setTool(tool)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool])
}
