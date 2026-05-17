import { useState, useEffect, useCallback, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  getLocalEntries, insertLocalEntry, updateLocalEntry, markSynced, markPendingDelete,
  deleteLocalEntry, upsertFromServer, getUnsyncedEntries, getPendingDeletes, pruneEntriesDeletedFromServer,
} from './db/database'
import { isServerReachable, fetchAllBodyWeightFromServer, postBodyWeightToServer, putBodyWeightToServer, deleteBodyWeightFromServer } from './api/client'

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
  const [dbError, setDbError] = useState(null)
  const [form, setForm] = useState({ weight: '', date: today(), note: '' })
  const [editEntry, setEditEntry] = useState(null)
  const [filterFrom, setFilterFrom] = useState(daysAgo(30))
  const [filterTo, setFilterTo] = useState(today())
  const syncingRef = useRef(false)

  const loadLocal = useCallback(async () => {
    setEntries(await getLocalEntries())
  }, [])

  const sync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    try {
      if (!await isServerReachable()) return
      for (const entry of await getUnsyncedEntries()) {
        if (entry.server_id) {
          await putBodyWeightToServer(entry.server_id, entry)
          await markSynced(entry.id, entry.server_id)
        } else {
          const created = await postBodyWeightToServer(entry)
          await markSynced(entry.id, created.id)
        }
      }
      for (const entry of await getPendingDeletes()) {
        await deleteBodyWeightFromServer(entry.server_id)
        await deleteLocalEntry(entry.id)
      }
      const serverEntries = await fetchAllBodyWeightFromServer()
      const serverIds = new Set(serverEntries.map(e => e.id))
      for (const entry of serverEntries) {
        await upsertFromServer(entry)
      }
      await pruneEntriesDeletedFromServer(serverIds)
    } catch { /* sin conexión */ } finally {
      syncingRef.current = false
      await loadLocal()
    }
  }, [loadLocal])

  useEffect(() => {
    async function init() {
      try {
        await loadLocal()
      } catch (e) {
        console.error('BodyWeight: error cargando datos locales', e)
        setDbError(String(e))
      } finally {
        setLoading(false)
      }
      sync()
    }
    init()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await insertLocalEntry(parseFloat(form.weight), form.date, form.note || null)
    setForm({ weight: '', date: today(), note: '' })
    await loadLocal()
    sync()
  }

  async function handleDelete(entry) {
    if (entry.server_id) {
      await markPendingDelete(entry.id)
    } else {
      await deleteLocalEntry(entry.id)
    }
    await loadLocal()
    sync()
  }

  async function handleEdit(e) {
    e.preventDefault()
    await updateLocalEntry(editEntry.id, parseFloat(editEntry.weight), editEntry.date, editEntry.note || null)
    setEditEntry(null)
    await loadLocal()
    sync()
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
    <>
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Body Weight</h1>
        <p className="page-subtitle">Registro diario de peso corporal</p>
      </div>

      {dbError && (
        <div style={{ background: '#3b0000', border: '1px solid #7f1d1d', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          <strong>Error DB:</strong> {dbError}
        </div>
      )}

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

        {!loading && displayed.length >= 2 && (() => {
          const chartData = [...displayed].reverse()
          const multiYear = chartData[0].date.slice(0, 4) !== chartData[chartData.length - 1].date.slice(0, 4)
          const fmt = d => multiYear ? d.slice(0, 7) : d.slice(5)
          return (
            <div className="bw-chart">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#181818" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: '#444', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#444', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#888' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={v => [`${v} kg`]}
                  />
                  <Line type="monotone" dataKey="weight" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3, fill: '#7c3aed' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        })()}

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
                    <button className="btn-icon" onClick={() => setEditEntry({ ...entry })} title="Editar">✎</button>
                    <button className="btn-delete" onClick={() => handleDelete(entry)}>×</button>
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

      {editEntry && (
        <div className="modal-overlay" onClick={() => setEditEntry(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar registro</h3>
              <button className="btn-delete" onClick={() => setEditEntry(null)}>×</button>
            </div>
            <form onSubmit={handleEdit} className="form" style={{ flexDirection: 'column' }}>
              <div className="field">
                <label>Peso (kg)</label>
                <input type="number" step="0.1" value={editEntry.weight}
                  onChange={e => setEditEntry(v => ({ ...v, weight: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Fecha</label>
                <input type="date" value={editEntry.date}
                  onChange={e => setEditEntry(v => ({ ...v, date: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Nota (opcional)</label>
                <input type="text" value={editEntry.note ?? ''}
                  onChange={e => setEditEntry(v => ({ ...v, note: e.target.value }))} />
              </div>
              <button type="submit" className="btn-primary">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default BodyWeight
