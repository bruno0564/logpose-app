export default function Settings({ dark, onToggle }) {
  return (
    <div className="settings-page">
      <h2 className="settings-title">Ajustes</h2>

      <div className="settings-section">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Modo oscuro</div>
            <div className="settings-row-sub">Cambia el aspecto de la app</div>
          </div>
          <button
            className={`theme-toggle ${dark ? 'theme-toggle--on' : ''}`}
            onClick={onToggle}
            aria-label="Toggle dark mode"
          >
            <span className="theme-toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  )
}
