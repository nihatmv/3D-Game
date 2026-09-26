import type { Tool } from '../store/useIslandStore'

/** Small hand-drawn-style SVG icons for the toolbar (24x24). */
export function ToolIcon({ tool }: { tool: Tool }) {
  switch (tool) {
    case 'soil':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M2 19 Q12 3 22 19 Z" fill="#b98a5e" />
          <path d="M2 19 Q12 11 22 19 Z" fill="#9a6d49" />
          <path d="M5.2 13.6 Q12 4.8 18.8 13.6" stroke="#8cc97a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'stone':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M3.5 17.5 L6.5 9.5 L12 5.5 L18 8 L21 15 L16.5 19.5 L8 20 Z" fill="#c9c4bd" />
          <path d="M12 5.5 L10.5 12 L6.5 9.5 Z" fill="#e4dfd8" />
          <path d="M10.5 12 L18 8 L21 15 L14.5 14.5 Z" fill="#b3ada5" />
          <path d="M3.5 17.5 L10.5 12 L14.5 14.5 L16.5 19.5 L8 20 Z" fill="#a9a39b" />
        </svg>
      )
    case 'water':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2.5 C12 2.5 4.5 10.8 4.5 15 a7.5 7.5 0 0 0 15 0 C19.5 10.8 12 2.5 12 2.5 Z" fill="#6fd6d0" />
          <path d="M8.6 15.2 a3.4 3.4 0 0 0 3.4 3.4" stroke="#f2fcfa" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'seeds':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <ellipse cx="12" cy="20.5" rx="6.5" ry="1.8" fill="#b98a5e" />
          <path d="M12 20.5 V11" stroke="#6fae63" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 12.5 C12 7.5 8 5 4 6 C4 10.5 7.8 13 12 12.5 Z" fill="#8fcf73" />
          <path d="M12 14.5 C12 10.5 15.2 8 20 8.6 C19.5 12.4 16.3 15 12 14.5 Z" fill="#a6d98a" />
        </svg>
      )
  }
}
