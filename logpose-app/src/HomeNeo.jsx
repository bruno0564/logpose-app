import { useState, useEffect, useCallback } from 'react'
import './HomeNeo.css'
import { getQuotes } from './db/database'
import { useLang } from './LangContext.jsx'

export default function HomeNeo() {
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
    <div className="neo-page">
      <svg style={{position:'absolute',width:0,height:0,overflow:'hidden'}}>
        <defs>
          <filter id="neo-hand-drawn">
            <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" result="noise" seed="2"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
      </svg>

      <div className="neo-badge">LOGPOSE</div>
      <div className="neo-header">
        <h1 className="neo-greeting">{greeting()}</h1>
        <p className="neo-date">{formatDate()}</p>
      </div>

      {current && (
        <div className="neo-quote-card">
          <div className="neo-quote-label">FRASE DEL DÍA</div>
          <p className="neo-quote-text">"{current.text}"</p>
          {current.author && <p className="neo-quote-author">— {current.author}</p>}
        </div>
      )}

      <div className="neo-section">
        <div className="neo-section-title">Botones</div>
        <div className="neo-row">
          <button className="neo-btn neo-btn--primary">Guardar</button>
          <button className="neo-btn neo-btn--cancel">Cancelar</button>
          <button className="neo-btn neo-btn--danger">Eliminar</button>
        </div>
      </div>

      <div className="neo-section">
        <div className="neo-section-title">Formulario</div>
        <div className="neo-form">
          <div className="neo-field">
            <label className="neo-label">Peso (kg)</label>
            <input className="neo-input" type="number" placeholder="75.5" />
          </div>
          <div className="neo-field">
            <label className="neo-label">Fecha</label>
            <input className="neo-input" type="date" />
          </div>
          <div className="neo-field">
            <label className="neo-label">Nota</label>
            <input className="neo-input" type="text" placeholder="Después de entrenar" />
          </div>
          <div className="neo-field neo-field--action">
            <button className="neo-btn neo-btn--primary">Registrar</button>
          </div>
        </div>
      </div>

      <div className="neo-section">
        <div className="neo-section-title">Stats</div>
        <div className="neo-stats">
          <div className="neo-stat-card neo-stat-card--yellow">
            <span className="neo-stat-value">75.3</span>
            <span className="neo-stat-label">kg actual</span>
          </div>
          <div className="neo-stat-card neo-stat-card--pink">
            <span className="neo-stat-value">-2.1</span>
            <span className="neo-stat-label">kg este mes</span>
          </div>
          <div className="neo-stat-card neo-stat-card--blue">
            <span className="neo-stat-value">47</span>
            <span className="neo-stat-label">días registrados</span>
          </div>
        </div>
      </div>

      <div className="neo-section">
        <div className="neo-section-title">Lista</div>
        <div className="neo-todo">
          {['Entrenar espalda', 'Registrar peso', 'Revisar rutina'].map((task, i) => (
            <div
              key={i}
              className={`neo-todo-item ${checks[i] ? 'neo-todo-item--done' : ''}`}
              onClick={() => setChecks(c => c.map((v, idx) => idx === i ? !v : v))}
            >
              <div className={`neo-check ${checks[i] ? 'neo-check--done' : ''}`}>
                {checks[i] && '✓'}
              </div>
              <span className="neo-todo-text">{task}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="neo-section">
        <div className="neo-section-title">Tabla</div>
        <div className="neo-table-wrap">
          <table className="neo-table">
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
