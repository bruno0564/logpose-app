import { useLang } from './LangContext.jsx'

export default function Settings({ dark, onToggle }) {
  const { t: tr, lang, setLang } = useLang()

  return (
    <div className="settings-page">
      <h2 className="settings-title">{tr('settings.title')}</h2>

      <div className="settings-section">
        <div className="settings-row">
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

        <div className="settings-row" style={{ marginTop: '1rem' }}>
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
                  color: lang === l ? '#fff' : 'var(--text-2)',
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
