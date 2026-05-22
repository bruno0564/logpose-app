import { useLang } from './LangContext.jsx'

const STYLES = [
  {
    id: 'normal',
    label: 'Normal',
    bg: '#111111',
    surface: '#1e1e1e',
    accent: '#818cf8',
    text: '#f0f0f0',
  },
  {
    id: 'warm',
    label: '🟠 Cálido',
    bg: '#f2dda4',
    surface: '#fdf5e0',
    accent: '#c41e1e',
    text: '#1a0a00',
  },
  {
    id: 'tv',
    label: '📺 Tele antigua',
    bg: '#2a2a2a',
    surface: '#333333',
    accent: '#e0ece0',
    text: '#e0ece0',
  },
  {
    id: 'tv-pixel',
    label: '📺 TV · Pixel',
    bg: '#2a2a2a',
    surface: '#333333',
    accent: '#e0ece0',
    text: '#e0ece0',
    fontLabel: 'PIXEL',
  },
  {
    id: 'cuphead',
    label: '🎮 Cuphead',
    bg: '#f0d9a0',
    surface: '#faecc8',
    accent: '#c01818',
    text: '#180800',
  },
]

export default function Settings({ dark, onToggle, appStyle, onStyleChange }) {
  const { t: tr, lang, setLang } = useLang()

  return (
    <div className="settings-page">
      <h2 className="settings-title">{tr('settings.title')}</h2>

      <div className="settings-section">
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <div className="settings-row-label">Estilo visual</div>
            <div className="settings-row-sub">Cambia la apariencia de toda la app</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem', width: '100%' }}>
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => onStyleChange(s.id)}
                style={{
                  background: s.bg,
                  border: appStyle === s.id
                    ? `2px solid ${s.accent}`
                    : '2px solid transparent',
                  borderRadius: '10px',
                  padding: '0.6rem 0.4rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: appStyle === s.id
                    ? `0 0 0 3px ${s.accent}40`
                    : '0 2px 6px rgba(0,0,0,0.2)',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  position: 'relative',
                  outline: 'none',
                }}
              >
                <div style={{
                  width: '100%',
                  height: '28px',
                  borderRadius: '6px',
                  background: s.surface,
                  border: `1px solid ${s.accent}50`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: '60%',
                    height: '6px',
                    borderRadius: '3px',
                    background: s.accent,
                    opacity: 0.9,
                  }} />
                </div>
                <span style={{
                  fontSize: '0.62rem',
                  color: s.text,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  fontWeight: 600,
                  textShadow: s.bg.startsWith('#f') ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
                }}>
                  {s.label}
                </span>
                {appStyle === s.id && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '5px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: s.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.55rem',
                    color: s.bg,
                    fontWeight: 700,
                  }}>
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {appStyle === 'normal' && (
          <div className="settings-row" style={{ borderTop: '1px solid var(--border)', marginTop: '0.25rem' }}>
            <div>
              <div className="settings-row-label">{tr('settings.darkMode')}</div>
              <div className="settings-row-sub">{tr('settings.darkModeDesc')}</div>
            </div>
            <button
              className={`theme-toggle ${dark ? 'theme-toggle--on' : ''}`}
              onClick={onToggle}
              aria-label="Toggle dark mode"
            >
              <span className="theme-toggle-thumb" />
            </button>
          </div>
        )}

        <div className="settings-row" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <div className="settings-row-label">{tr('settings.language')}</div>
            <div className="settings-row-sub">{tr('settings.languageDesc')}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {['en', 'es'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-2)',
                  cursor: 'pointer',
                  background: lang === l ? 'var(--accent)' : 'var(--surface-2)',
                  color: lang === l ? 'var(--bg)' : 'var(--text-2)',
                  transition: 'all 0.15s',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
