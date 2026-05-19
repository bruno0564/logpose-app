import { useState, useEffect } from 'react'
import Home from './Home.jsx'
import BodyWeight from './BodyWeight.jsx'
import Gym from './Gym.jsx'
import Calendar from './Calendar.jsx'
import Tasks from './Tasks.jsx'
import Quotes from './Quotes.jsx'
import Journal from './Journal.jsx'
import Settings from './Settings.jsx'
import { LangProvider, useLang } from './LangContext.jsx'

const API = 'http://localhost:8000'

const NAV_IDS = ['home', 'body-weight', 'gym', 'calendar', 'todo', 'quotes', 'journal']

function Sidebar({ active, onNav, online }) {
  const { t: tr } = useLang()

  const navLabel = {
    'home':        tr('nav.home'),
    'body-weight': tr('nav.weight'),
    'gym':         tr('nav.gym'),
    'calendar':    tr('nav.calendar'),
    'todo':        tr('nav.todo'),
    'quotes':      tr('nav.quotes'),
    'journal':     tr('nav.journal'),
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-name">Logpose</span>
        <div className="brand-status">
          <span className={`brand-dot ${online ? 'brand-dot--online' : 'brand-dot--offline'}`} />
          <span className="brand-status-text">{online ? tr('nav.serverOnline') : tr('nav.serverOffline')}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_IDS.map(id => (
          <button
            key={id}
            className={`nav-item ${active === id ? 'nav-item--active' : ''}`}
            onClick={() => onNav(id)}
          >
            {navLabel[id]}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className={`nav-item ${active === 'settings' ? 'nav-item--active' : ''}`}
          onClick={() => onNav('settings')}
        >
          {tr('nav.settings')}
        </button>
      </div>
    </aside>
  )
}

function AppContent() {
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

function App() {
  return (
    <LangProvider>
      <AppContent />
    </LangProvider>
  )
}

export default App
