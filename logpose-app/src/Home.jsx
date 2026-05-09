import { useState, useEffect } from 'react'
import './Home.css'

const API = 'http://archlinux.local:8000'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function greeting() {
  const h = new Date().getHours()
  if (h < 13) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatDate() {
  const d = new Date()
  return `${DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
}

function loadQuotes() {
  try { return JSON.parse(localStorage.getItem('logpose_quotes') || '[]') } catch { return [] }
}

function saveQuotes(qs) {
  localStorage.setItem('logpose_quotes', JSON.stringify(qs))
}

export default function Home() {
  const [latest, setLatest] = useState(null)
  const [quotes, setQuotes] = useState(loadQuotes)
  const [index, setIndex] = useState(0)
  const [newQuote, setNewQuote] = useState('')
  const [managing, setManaging] = useState(false)

  useEffect(() => {
    fetch(`${API}/body-weight/`)
      .then(r => r.json())
      .then(data => setLatest(data[0] ?? null))
      .catch(() => {})
  }, [])

  // Seed default quote if empty
  useEffect(() => {
    if (quotes.length === 0) {
      const defaults = [{ id: Date.now(), text: 'As long as I live, there are infinite chances.' }]
      setQuotes(defaults)
      saveQuotes(defaults)
    }
  }, [])

  const current = quotes[index] ?? null

  function next() {
    if (quotes.length > 1) setIndex(i => (i + 1) % quotes.length)
  }

  function handleAddQuote(e) {
    e.preventDefault()
    if (!newQuote.trim()) return
    const updated = [...quotes, { id: Date.now(), text: newQuote.trim() }]
    setQuotes(updated)
    saveQuotes(updated)
    setNewQuote('')
  }

  function handleDeleteQuote(id) {
    const updated = quotes.filter(q => q.id !== id)
    setQuotes(updated)
    saveQuotes(updated)
    if (index >= updated.length) setIndex(Math.max(0, updated.length - 1))
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <h1 className="home-greeting">{greeting()}</h1>
        <p className="home-date">{formatDate()}</p>
      </div>

      {latest && (
        <div className="home-stat-card">
          <span className="home-stat-label">Último peso registrado</span>
          <span className="home-stat-value">{latest.weight} kg</span>
          <span className="home-stat-sub">{latest.date}</span>
        </div>
      )}

      <div className="home-quote-card" onClick={next} title={quotes.length > 1 ? 'Clic para siguiente' : ''}>
        {current
          ? <p className="home-quote-text">"{current.text}"</p>
          : <p className="home-hint">Añade tu primera frase.</p>
        }
        {quotes.length > 1 && (
          <span className="home-quote-pager">{index + 1} / {quotes.length}</span>
        )}
      </div>

      <button className="home-manage-btn" onClick={() => setManaging(m => !m)}>
        {managing ? 'Cerrar' : 'Gestionar frases'}
      </button>

      {managing && (
        <div className="card home-manage-card">
          <p className="card-title">Mis frases</p>
          <form onSubmit={handleAddQuote} className="home-add-form">
            <input
              type="text"
              placeholder="Nueva frase..."
              value={newQuote}
              onChange={e => setNewQuote(e.target.value)}
            />
            <button type="submit" className="btn-primary">Añadir</button>
          </form>
          <ul className="home-quote-list">
            {quotes.map(q => (
              <li key={q.id} className="home-quote-item">
                <span>"{q.text}"</span>
                <button className="btn-delete" onClick={() => handleDeleteQuote(q.id)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
