export const THEMES = [
  { id: 'normal',   label: 'Normal',          bg: '#111111', surface: '#1e1e1e', accent: '#818cf8', text: '#f0f0f0' },
  { id: 'warm',     label: '🟠 Cálido',        bg: '#f2dda4', surface: '#fdf5e0', accent: '#c41e1e', text: '#1a0a00' },
  { id: 'tv',       label: '📺 Tele antigua',  bg: '#2a2a2a', surface: '#333333', accent: '#e0ece0', text: '#e0ece0' },
  { id: 'tv-pixel', label: '📺 TV · Pixel',    bg: '#2a2a2a', surface: '#333333', accent: '#e0ece0', text: '#e0ece0', fontLabel: 'PIXEL' },
  { id: 'cuphead',  label: '🎮 Cuphead',        bg: '#f0d9a0', surface: '#faecc8', accent: '#c01818', text: '#180800' },
]

export const CARTOON_IDS = THEMES.filter(t => t.id !== 'normal').map(t => t.id)
