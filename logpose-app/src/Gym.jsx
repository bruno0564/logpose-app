import { useState, useEffect } from 'react'
import './Gym.css'

const API = 'http://archlinux.local:8000'

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Otro']

function ExerciseModal({ exercise, onClose, onSave }) {
  const [name, setName] = useState(exercise?.name ?? '')
  const [muscle, setMuscle] = useState(exercise?.muscle_group ?? '')
  const [notes, setNotes] = useState(exercise?.notes ?? '')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), muscle_group: muscle || null, notes: notes.trim() || null })
  }

  return (
    <div className="gym-overlay" onClick={onClose}>
      <div className="gym-modal" onClick={e => e.stopPropagation()}>
        <div className="gym-modal-header">
          <h3>{exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h3>
          <button className="btn-delete" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre *</label>
            <input
              autoFocus
              type="text"
              placeholder="Ej: Press banca"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Grupo muscular</label>
            <div className="gym-chips">
              {MUSCLE_GROUPS.map(g => (
                <button
                  key={g}
                  type="button"
                  className={`gym-chip ${muscle === g ? 'gym-chip--active' : ''}`}
                  onClick={() => setMuscle(muscle === g ? '' : g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Notas</label>
            <input
              type="text"
              placeholder="Ej: Agarre ancho"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="field field--action" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Gym() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | exercise object

  async function fetchExercises() {
    const res = await fetch(`${API}/exercises/`)
    setExercises(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchExercises() }, [])

  async function handleSave({ name, muscle_group, notes }) {
    if (modal && modal !== 'new') {
      await fetch(`${API}/exercises/${modal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, muscle_group, notes }),
      })
    } else {
      await fetch(`${API}/exercises/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, muscle_group, notes, position: exercises.length }),
      })
    }
    setModal(null)
    fetchExercises()
  }

  async function handleDelete(ex) {
    if (!confirm(`¿Eliminar "${ex.name}"?`)) return
    await fetch(`${API}/exercises/${ex.id}`, { method: 'DELETE' })
    fetchExercises()
  }

  const grouped = exercises.reduce((acc, ex) => {
    const key = ex.muscle_group || 'Sin grupo'
    if (!acc[key]) acc[key] = []
    acc[key].push(ex)
    return acc
  }, {})

  return (
    <div className="page">
      <div className="page-header">
        <div className="gym-page-title-row">
          <h1 className="page-title">Gym</h1>
          <button className="btn-primary" onClick={() => setModal('new')}>+ Ejercicio</button>
        </div>
        <p className="page-subtitle">Gestión de ejercicios</p>
      </div>

      {loading ? (
        <p className="hint">Cargando...</p>
      ) : exercises.length === 0 ? (
        <p className="hint">Sin ejercicios todavía. Añade el primero arriba.</p>
      ) : (
        Object.entries(grouped).map(([group, exs]) => (
          <div key={group} className="gym-group">
            <p className="gym-group-label">{group}</p>
            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Ejercicio</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {exs.map(ex => (
                    <tr key={ex.id}>
                      <td style={{ color: '#e8e8e8', fontWeight: 500 }}>{ex.name}</td>
                      <td className="note-cell">{ex.notes ?? '—'}</td>
                      <td style={{ width: 80 }}>
                        <button className="btn-icon" onClick={() => setModal(ex)} title="Editar">✎</button>
                        <button className="btn-delete" onClick={() => handleDelete(ex)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {modal && (
        <ExerciseModal
          exercise={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
