import { useState, useEffect } from 'react'

const API = 'http://archlinux.local:8000'

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
  const [form, setForm] = useState({
    weight: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  })

  async function fetchEntries() {
    const res = await fetch(`${API}/body-weight/`)
    const data = await res.json()
    setEntries(data)
    setLoading(false)
  }

  useEffect(() => { fetchEntries() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await fetch(`${API}/body-weight/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        weight: parseFloat(form.weight),
        note: form.note || null,
      }),
    })
    setForm({ weight: '', date: new Date().toISOString().split('T')[0], note: '' })
    fetchEntries()
  }

  async function handleDelete(id) {
    await fetch(`${API}/body-weight/${id}`, { method: 'DELETE' })
    fetchEntries()
  }

  const latest = entries[0]?.weight
  const avg = entries.length
    ? (entries.reduce((sum, e) => sum + e.weight, 0) / entries.length).toFixed(1)
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
            <input
              type="number"
              step="0.1"
              placeholder="75.5"
              value={form.weight}
              onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>Nota (opcional)</label>
            <input
              type="text"
              placeholder="Ej: después de entrenar"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="field field--action">
            <button type="submit" className="btn-primary">Añadir</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">Historial</h2>
        {loading ? (
          <p className="hint">Cargando...</p>
        ) : entries.length === 0 ? (
          <p className="hint">Sin registros todavía. Añade el primero arriba.</p>
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
              {entries.map(entry => (
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
      </div>
    </div>
  )
}

export default BodyWeight
