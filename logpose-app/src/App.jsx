import { useState } from 'react'
import Home from './Home.jsx'
import BodyWeight from './BodyWeight.jsx'
import Gym from './Gym.jsx'

const NAV = [
  { id: 'home',         label: 'Inicio' },
  { id: 'body-weight',  label: 'Peso' },
  { id: 'gym',          label: 'Gym' },
]

function Sidebar({ active, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-name">Logpose</span>
        <span className="brand-sub">life tracking</span>
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

  return (
    <div className="layout">
      <Sidebar active={page} onNav={setPage} />
      <main className="main">
        {page === 'home'        && <Home />}
        {page === 'body-weight' && <BodyWeight />}
        {page === 'gym'         && <Gym />}
      </main>
    </div>
  )
}

export default App
