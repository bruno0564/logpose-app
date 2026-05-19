import { useState, useEffect } from 'react'
import Home from './Home.jsx'
import BodyWeight from './BodyWeight.jsx'
import Gym from './Gym.jsx'
import Calendar from './Calendar.jsx'
import Tasks from './Tasks.jsx'
import Quotes from './Quotes.jsx'
import Journal from './Journal.jsx'
import Settings from './Settings.jsx'

const API = 'http://localhost:8000'

const NAV = [
  { id: 'home',         label: 'Inicio' },
  { id: 'body-weight',  label: 'Peso' },
  { id: 'gym',          label: 'Gym' },
  { id: 'calendar',     label: 'Calendario' },
  { id: 'todo',         label: 'To-Do' },
  { id: 'quotes',       label: 'Quotes' },
  { id: 'journal',      label: 'Diario' },
]

function Sidebar({ active, onNav, online }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-name">Logpose</span>
        <div className="brand-status">
          <span className={`brand-dot ${online ? 'brand-dot--online' : 'brand-dot--offline'}`} />
          <span className="brand-status-text">{online ? 'Servidor conectado' : 'Sin servidor'}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? 'nav-item--active' : ''}`}
            onClick={() => onNav(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className={`nav-item ${active === 'settings' ? 'nav-item--active' : ''}`}
          onClick={() => onNav('settings')}
        >
          Ajustes
        </button>
      </div>
    </aside>
  )
}

function App() {
  const [page, setPage] = useState('home')
  const [online, setOnline] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    async function check() {
      try {
        await fetch(`${API}/`, { signal: AbortSignal.timeout(3000) })
        setOnline(true)
      } catch {
        setOnline(false)
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="layout">
      <Sidebar active={page} onNav={setPage} online={online} />
      <main className="main">
        {page === 'home'        && <Home />}
        {page === 'body-weight' && <BodyWeight />}
        {page === 'gym'         && <Gym />}
        {page === 'calendar'    && <Calendar />}
        {page === 'todo'        && <Tasks />}
        {page === 'quotes'      && <Quotes />}
        {page === 'journal'     && <Journal />}
        {page === 'settings'    && <Settings dark={dark} onToggle={() => setDark(d => !d)} />}
      </main>
    </div>
  )
}

export default App
