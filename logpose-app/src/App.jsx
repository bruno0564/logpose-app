import { useState } from 'react'
import BodyWeight from './BodyWeight.jsx'

const NAV = [
  { id: 'body-weight', label: 'Body Weight' },
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
  const [page, setPage] = useState('body-weight')

  return (
    <div className="layout">
      <Sidebar active={page} onNav={setPage} />
      <main className="main">
        {page === 'body-weight' && <BodyWeight />}
      </main>
    </div>
  )
}

export default App
