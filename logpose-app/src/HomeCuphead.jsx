import { useState, useEffect, useCallback } from 'react'
import './HomeCuphead.css'
import { getQuotes } from './db/database'
import { useLang } from './LangContext.jsx'

export default function HomeCuphead({ palette = 'warm' }) {
  const { t: tr, locale } = useLang()
  const [current, setCurrent] = useState(null)
  const [checks, setChecks] = useState([false, true, false])

  function greeting() {
    const h = new Date().getHours()
    if (h < 13) return tr('home.greetingMorning')
    if (h < 21) return tr('home.greetingAfternoon')
    return tr('home.greetingEvening')
  }

  function formatDate() {
    const d = new Date()
    const str = d.toLocaleDateString(locale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  const load = useCallback(async () => {
    const qs = await getQuotes()
    if (qs.length > 0) setCurrent(qs[Math.floor(Math.random() * qs.length)])
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="cup-page" data-palette={palette}>

      <div className="cup-ornament">✦ ✦ ✦</div>
      <div className="cup-header">
        <h1 className="cup-greeting">{greeting()}</h1>
        <p className="cup-date">{formatDate()}</p>
      </div>

      {current && (
        <div className="cup-quote-card">
          <div className="cup-quote-stars">★ ★ ★</div>
          <p className="cup-quote-text">"{current.text}"</p>
          {current.author && <p className="cup-quote-author">— {current.author}</p>}
        </div>
      )}

      <div className="cup-section">
        <div className="cup-section-title">Botones</div>
        <div className="cup-row">
          <button className="cup-btn cup-btn--primary">Guardar</button>
          <button className="cup-btn cup-btn--cancel">Cancelar</button>
          <button className="cup-btn cup-btn--danger">Eliminar</button>
        </div>
      </div>

      <div className="cup-section">
        <div className="cup-section-title">Formulario</div>
        <div className="cup-form">
          <div className="cup-field">
            <label className="cup-label">Peso (kg)</label>
            <input className="cup-input" type="number" placeholder="75.5" />
          </div>
          <div className="cup-field">
            <label className="cup-label">Fecha</label>
            <input className="cup-input" type="date" />
          </div>
          <div className="cup-field">
            <label className="cup-label">Nota</label>
            <input className="cup-input" type="text" placeholder="Después de entrenar" />
          </div>
          <div className="cup-field cup-field--action">
            <button className="cup-btn cup-btn--primary">Registrar</button>
          </div>
        </div>
      </div>

      <div className="cup-section">
        <div className="cup-section-title">Stats</div>
        <div className="cup-stats">
          <div className="cup-stat-card">
            <span className="cup-stat-value">75.3</span>
            <span className="cup-stat-label">kg actual</span>
          </div>
          <div className="cup-stat-card">
            <span className="cup-stat-value">-2.1</span>
            <span className="cup-stat-label">kg este mes</span>
          </div>
          <div className="cup-stat-card">
            <span className="cup-stat-value">47</span>
            <span className="cup-stat-label">días registrados</span>
          </div>
        </div>
      </div>

      <div className="cup-section">
        <div className="cup-section-title">Lista</div>
        <div className="cup-todo">
          {['Entrenar espalda', 'Registrar peso', 'Revisar rutina'].map((task, i) => (
            <div
              key={i}
              className={`cup-todo-item ${checks[i] ? 'cup-todo-item--done' : ''}`}
              onClick={() => setChecks(c => c.map((v, idx) => idx === i ? !v : v))}
            >
              <div className={`cup-check ${checks[i] ? 'cup-check--done' : ''}`}>
                {checks[i] && '✓'}
              </div>
              <span className="cup-todo-text">{task}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cup-section">
        <div className="cup-section-title">Tabla</div>
        <div className="cup-table-wrap">
          <table className="cup-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peso</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>22/05/2026</td><td>75.3 kg</td><td>Después de entrenar</td></tr>
              <tr><td>21/05/2026</td><td>75.8 kg</td><td>—</td></tr>
              <tr><td>20/05/2026</td><td>76.1 kg</td><td>Día de descanso</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
