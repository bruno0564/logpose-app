const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconEdit({ size = 16, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

export function IconClose({ size = 16, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconCheck({ size = 16, strokeWidth = 2, style }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth} style={style}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconChevronDown({ size = 14, strokeWidth = 2 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconChevronUp({ size = 14, strokeWidth = 2 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

export function IconChevronLeft({ size = 20, strokeWidth = 2 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function IconChevronRight({ size = 20, strokeWidth = 2 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function IconHome({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 21 9 13 15 13 15 21" />
    </svg>
  )
}

export function IconWeight({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export function IconGym({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <line x1="6.5" y1="12" x2="17.5" y2="12" />
      <path d="M3 10.5h2.5v3H3z" />
      <path d="M18.5 10.5H21v3h-2.5z" />
      <path d="M5.5 11h1.5v2H5.5z" />
      <path d="M17 11h1.5v2H17z" />
    </svg>
  )
}

export function IconCalendar({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export function IconList({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconQuote({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  )
}

export function IconJournal({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  )
}

export function IconHabit({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

export function IconSettings({ size = 15, strokeWidth = 1.75 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
