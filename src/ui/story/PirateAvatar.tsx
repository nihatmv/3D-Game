/** The captain's portrait: an anime-style pirate (tricorn, eye patch, grin). Pure SVG. */
export function PirateAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="pirate-avatar">
      <defs>
        <clipPath id="pirate-clip">
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <linearGradient id="pirate-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fdcd5" />
          <stop offset="1" stopColor="#3aa9b8" />
        </linearGradient>
      </defs>
      <g clipPath="url(#pirate-clip)">
        <rect width="100" height="100" fill="url(#pirate-sky)" />
        {/* Coat and shirt */}
        <path d="M10 100 Q14 83 36 80 L64 80 Q86 83 90 100 Z" fill="#b8443a" />
        <path d="M36 80 L44 80 L50 95 L56 80 L64 80 L58 100 L42 100 Z" fill="#8f2f29" />
        <path d="M43 80 L50 94 L57 80 Z" fill="#f7efe3" />
        <rect x="43" y="70" width="14" height="12" fill="#efbf9b" />
        {/* Hair behind the face */}
        <path d="M27 42 Q21 64 29 76 L35 60 Z" fill="#2b2f4a" />
        <path d="M73 42 Q79 64 71 76 L65 60 Z" fill="#2b2f4a" />
        {/* Ears and earring */}
        <ellipse cx="29" cy="56" rx="3.6" ry="5" fill="#f7cba8" />
        <ellipse cx="71" cy="56" rx="3.6" ry="5" fill="#f7cba8" />
        <circle cx="71.5" cy="63.5" r="2.6" fill="none" stroke="#e9b949" strokeWidth="1.4" />
        {/* Face */}
        <path d="M29 44 Q29 69 41 78 Q50 85 59 78 Q71 69 71 44 Q71 30 50 30 Q29 30 29 44 Z" fill="#ffdcbf" />
        {/* Bangs */}
        <path d="M28 47 L32 37 L36 46 L40 35 L45 44 L50 34 L55 44 L60 35 L64 45 L68 37 L72 47 L72 36 Q50 26 28 36 Z" fill="#2b2f4a" />
        {/* Tricorn hat with gold trim and skull */}
        <path d="M29 32 Q31 9 50 8 Q69 9 71 32 Z" fill="#23202b" />
        <path d="M8 37 Q14 26 27 23 Q50 31 73 23 Q86 26 92 37 Q71 27 50 32 Q29 27 8 37 Z" fill="#2e2a37" />
        <path d="M8 37 Q29 27 50 32 Q71 27 92 37" fill="none" stroke="#e9b949" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M44 22 L56 27 M56 22 L44 27" stroke="#f4ecdc" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="50" cy="18.5" r="4.6" fill="#f4ecdc" />
        <circle cx="48.3" cy="18.3" r="1.1" fill="#23202b" />
        <circle cx="51.7" cy="18.3" r="1.1" fill="#23202b" />
        {/* Brows */}
        <path d="M33 45.5 L46 48" stroke="#2b2f4a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M54 48 L67 45.5" stroke="#2b2f4a" strokeWidth="2.4" strokeLinecap="round" />
        {/* Big anime eye */}
        <ellipse cx="40" cy="56" rx="6" ry="7.4" fill="#fff" />
        <ellipse cx="40.6" cy="56.8" rx="4.6" ry="6.2" fill="#2a8f9a" />
        <ellipse cx="40.6" cy="54.2" rx="4.6" ry="3.4" fill="#1f6c78" />
        <ellipse cx="40.6" cy="57.2" rx="2.2" ry="3" fill="#10232b" />
        <circle cx="38.6" cy="53.8" r="1.7" fill="#fff" />
        <circle cx="42.6" cy="59.4" r="0.8" fill="#fff" />
        <path d="M33 51 Q40 46.5 47 50.5" fill="none" stroke="#1f1d26" strokeWidth="2.3" strokeLinecap="round" />
        {/* Eye patch */}
        <path d="M29 39 L72 53" stroke="#1a1a1f" strokeWidth="2" />
        <ellipse cx="60" cy="56" rx="7" ry="6.2" fill="#1a1a1f" />
        {/* Blush, nose, scar */}
        <ellipse cx="35" cy="65" rx="3.6" ry="1.6" fill="#ff9e9e" opacity="0.55" />
        <ellipse cx="65" cy="66" rx="3.6" ry="1.6" fill="#ff9e9e" opacity="0.55" />
        <path d="M50.5 60 L49 64.5 L51.5 64.5" fill="none" stroke="#e0a988" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M63 62.5 L67.5 69 M64 67 L67.5 64.5" stroke="#d98b7a" strokeWidth="1" strokeLinecap="round" />
        {/* Grin with a fang */}
        <path d="M42 68.5 Q50 79 58 68.5 Z" fill="#6b2a2a" />
        <path d="M42.6 68.8 L57.4 68.8 L56.4 70.6 L43.6 70.6 Z" fill="#fff" />
        <path d="M45 70.4 L46.2 73 L47.4 70.4 Z" fill="#fff" />
        <path d="M45.5 74.8 Q50 77 54.5 74.8 Q50 76 45.5 74.8 Z" fill="#e86f6f" />
      </g>
    </svg>
  )
}
