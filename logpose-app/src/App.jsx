import { useState, useEffect } from 'react'
import Home from './Home.jsx'
import BodyWeight from './BodyWeight.jsx'
import Gym from './Gym.jsx'

const API = 'http://archlinux.local:8000'

const NAV = [
  { id: 'home',         label: 'Inicio' },
  { id: 'body-weight',  label: 'Peso' },
  { id: 'gym',          label: 'Gym' },
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
    </aside>
  )
}

function App() {
  const [page, setPage] = useState('home')
  const [online, setOnline] = useState(false)

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
      </main>
    </div>
  )
}

export default App
