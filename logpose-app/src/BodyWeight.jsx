import { useState, useEffect } from 'react'

const API = 'http://archlinux.local:8000'

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().split('T')[0] }

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function BodyWeight() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ weight: '', date: today(), note: '' })
  const [filterFrom, setFilterFrom] = useState(daysAgo(30))
  const [filterTo, setFilterTo] = useState(today())

  async function fetchEntries() {
    const res = await fetch(`${API}/body-weight/`)
    setEntries(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchEntries() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await fetch(`${API}/body-weight/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, weight: parseFloat(form.weight), note: form.note || null }),
    })
    setForm({ weight: '', date: today(), note: '' })
    fetchEntries()
  }

  async function handleDelete(id) {
    await fetch(`${API}/body-weight/${id}`, { method: 'DELETE' })
    fetchEntries()
  }

  const displayed = entries.filter(e => {
    if (filterFrom && e.date < filterFrom) return false
    if (filterTo && e.date > filterTo) return false
    return true
  })

  const latest = entries[0]?.weight
  const avg = entries.length
    ? (entries.reduce((s, e) => s + e.weight, 0) / entries.length).toFixed(1)
    : null

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Body Weight</h1>
        <p className="page-subtitle">Registro diario de peso corporal</p>
      </div>

      <div className="stats-row">
        <StatCard label="Último registro" value={latest ? `${latest} kg` : '—'} />
        <StatCard label="Media" value={avg ? `${avg} kg` : '—'} />
        <StatCard label="Total registros" value={entries.length || '—'} />
      </div>

      <div className="card">
        <h2 className="card-title">Nuevo registro</h2>
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label>Peso (kg)</label>
            <input type="number" step="0.1" placeholder="75.5" value={form.weight}
              onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Nota (opcional)</label>
            <input type="text" placeholder="Ej: después de entrenar" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="field field--action">
            <button type="submit" className="btn-primary">Añadir</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">Historial</h2>

        <div className="bw-filter-row">
          <div className="field">
            <label>Desde</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Hasta</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          <button className="bw-filter-reset" onClick={() => { setFilterFrom(daysAgo(30)); setFilterTo(today()) }}>
            Últimos 30 días
          </button>
        </div>

        {loading ? (
          <p className="hint">Cargando...</p>
        ) : displayed.length === 0 ? (
          <p className="hint">Sin registros en ese rango.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peso</th>
                <th>Nota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td className="weight-cell">{entry.weight} kg</td>
                  <td className="note-cell">{entry.note ?? '—'}</td>
                  <td>
                    <button className="btn-delete" onClick={() => handleDelete(entry.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && (filterFrom || filterTo) && displayed.length > 0 && (
          <p className="hint" style={{ marginTop: '0.75rem' }}>{displayed.length} registro{displayed.length !== 1 ? 's' : ''} en el rango</p>
        )}
      </div>
    </div>
  )
}

export default BodyWeight
