import { useState, useEffect, useCallback } from 'react'
import {
  getRoutines, insertLocalRoutine, deleteLocalRoutine, purgeLocalRoutine,
  getUnsyncedRoutines, getPendingDeleteRoutines,
  markRoutineSynced, upsertRoutineFromServer, pruneStaleRoutines,
  getExercises, insertLocalExercise,
  getAllRoutineExercises,
  insertRoutineExercise, deleteRoutineExercise,
  insertWorkoutSession, insertWorkoutSet,
  getActiveRoutine, setActiveRoutine,
} from './db/database'
import {
  isServerReachable,
  fetchAllRoutinesFromServer, postRoutineToServer, deleteRoutineFromServer,
} from './api/client'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

let syncingRoutines = false

export default function Gym() {
  const [view, setView] = useState('routines')
  const [routines, setRoutines] = useState([])
  const [activeRoutineId, setActiveRoutineId] = useState(null)
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [routineExercises, setRoutineExercises] = useState([])
  const [exercises, setExercises] = useState([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmTarget, setConfirmTarget] = useState(null)

  const loadRoutines = useCallback(async () => {
    setRoutines(await getRoutines())
    const active = await getActiveRoutine()
    setActiveRoutineId(active?.id ?? null)
  }, [])

  const loadExercises = useCallback(async () => {
    setExercises(await getExercises())
  }, [])

  const loadRoutineExercises = useCallback(async (routine) => {
    if (!routine) return
    setRoutineExercises(await getAllRoutineExercises(routine.id))
  }, [])

  const syncRoutines = useCallback(async () => {
    if (syncingRoutines) return
    syncingRoutines = true
    try {
      if (!await isServerReachable()) return
      for (const r of await getPendingDeleteRoutines()) {
        try { await deleteRoutineFromServer(r.server_id) } catch { /* already gone */ }
        await purgeLocalRoutine(r.id)
      }
      for (const r of await getUnsyncedRoutines()) {
        const created = await postRoutineToServer(r)
        await markRoutineSynced(r.id, created.id)
      }
      const serverRoutines = await fetchAllRoutinesFromServer()
      for (const r of serverRoutines) {
        await upsertRoutineFromServer(r)
      }
      await pruneStaleRoutines(new Set(serverRoutines.map(r => r.id)))
    } catch { /* offline */ } finally {
      syncingRoutines = false
      await loadRoutines()
    }
  }, [loadRoutines])

  useEffect(() => {
    loadRoutines().then(() => syncRoutines())
    loadExercises()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    await insertLocalRoutine(newName.trim())
    setNewName('')
    setAdding(false)
    await loadRoutines()
    syncRoutines()
  }

  async function handleActivate(e, r) {
    e.stopPropagation()
    await setActiveRoutine(r.id)
    setActiveRoutineId(r.id)
  }

  async function handleDelete(r) {
    setConfirmTarget(r)
  }

  async function confirmDelete() {
    const r = confirmTarget
    setConfirmTarget(null)
    await deleteLocalRoutine(r.id)
    await loadRoutines()
    syncRoutines()
  }

  function openRoutine(routine) {
    setSelectedRoutine(routine)
    loadRoutineExercises(routine)
    setView('routine-detail')
  }

  if (view === 'train') {
    const dayExercises = routineExercises.filter(re => re.day_of_week === selectedDay)
    return (
      <TrainView
        routine={selectedRoutine}
        day={selectedDay}
        dayExercises={dayExercises}
        onBack={() => setView('routine-detail')}
      />
    )
  }

  if (view === 'routine-detail') {
    return (
      <RoutineDetailView
        routine={selectedRoutine}
        routineExercises={routineExercises}
        exercises={exercises}
        onBack={() => { setView('routines'); setSelectedRoutine(null) }}
        onTrain={(day) => { setSelectedDay(day); setView('train') }}
        onExercisesChange={() => loadRoutineExercises(selectedRoutine)}
        onExercisesListChange={loadExercises}
      />
    )
  }

  return (
    <div className="page">
      {confirmTarget && (
        <ConfirmModal
          message={`¿Eliminar la rutina "${confirmTarget.name}"?`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="page-title">Gym</h1>
          <button className="btn-primary" onClick={() => setAdding(a => !a)}>+ Rutina</button>
        </div>
        <p className="page-subtitle">Tus rutinas de entrenamiento</p>
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: '1.25rem', maxWidth: 400 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <input
              autoFocus
              type="text"
              placeholder="Nombre de la rutina..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: '0.5rem 0.75rem',
                background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontSize: '0.85rem', outline: 'none',
              }}
            />
            <button type="submit" className="btn-primary">Crear</button>
            <button type="button" className="btn-cancel" onClick={() => { setAdding(false); setNewName('') }}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {routines.length === 0 ? (
        <p className="hint">Sin rutinas todavía. Crea la primera arriba.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 480 }}>
          {routines.map(r => {
            const isActive = r.id === activeRoutineId
            return (
              <div
                key={r.id}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 0, padding: '1rem 1.25rem', cursor: 'pointer',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onClick={() => openRoutine(r)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {isActive && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Activa
                    </span>
                  )}
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem', fontWeight: 500 }}>{r.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {!isActive && (
                    <button
                      className="btn-cancel"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', height: 'auto' }}
                      onClick={e => handleActivate(e, r)}
                    >
                      Activar
                    </button>
                  )}
                  <button className="btn-delete" onClick={e => { e.stopPropagation(); handleDelete(r) }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Routine Detail ────────────────────────────────────────────────────────────

function RoutineDetailView({ routine, routineExercises, exercises, onBack, onTrain, onExercisesChange, onExercisesListChange }) {
  const [pickerDay, setPickerDay] = useState(null)

  return (
    <div className="page">
      {pickerDay !== null && (
        <ExercisePickerModal
          day={pickerDay}
          routine={routine}
          exercises={exercises}
          routineExercises={routineExercises}
          onClose={() => setPickerDay(null)}
          onAdded={() => { onExercisesChange(); onExercisesListChange() }}
        />
      )}

      <div className="page-header">
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          ← Volver
        </button>
        <h1 className="page-title">{routine.name}</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 480 }}>
        {DAYS.map((dayName, idx) => {
          const dayExs = routineExercises.filter(re => re.day_of_week === idx)
          return (
            <div key={idx} className="card" style={{ marginBottom: 0, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dayExs.length > 0 ? '0.6rem' : 0 }}>
                <span style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: 600 }}>{dayName}</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {dayExs.length > 0 && (
                    <button
                      className="btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      onClick={() => onTrain(idx)}
                    >
                      Entrenar
                    </button>
                  )}
                  <button
                    onClick={() => setPickerDay(idx)}
                    style={{ background: 'none', border: '1px solid var(--border-2)', color: 'var(--text-2)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.55rem', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1 }}
                  >
                    +
                  </button>
                </div>
              </div>

              {dayExs.length === 0 ? (
                <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Descanso</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {dayExs.map(re => (
                    <div key={re.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>
                        {re.muscle_group && (
                          <span style={{ color: 'var(--text-3)', fontSize: '0.72rem', marginRight: '0.35rem' }}>[{re.muscle_group}]</span>
                        )}
                        {re.exercise_name}
                      </span>
                      <button
                        onClick={async () => { await deleteRoutineExercise(re.id); onExercisesChange() }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Exercise Picker Modal ────────────────────────────────────────────────────

function ExercisePickerModal({ day, routine, exercises, routineExercises, onClose, onAdded }) {
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const muscleGroups = [...new Set(exercises.map(e => e.muscle_group).filter(Boolean))].sort()
  const suggestions = muscleGroups.filter(g =>
    g.toLowerCase().includes(newMuscle.toLowerCase()) && g.toLowerCase() !== newMuscle.toLowerCase()
  )

  const alreadyAdded = new Set(
    routineExercises.filter(re => re.day_of_week === day).map(re => re.local_exercise_id)
  )

  const grouped = exercises.reduce((acc, ex) => {
    const g = ex.muscle_group || 'Sin grupo'
    if (!acc[g]) acc[g] = []
    acc[g].push(ex)
    return acc
  }, {})

  async function handleAdd(exercise) {
    const pos = routineExercises.filter(re => re.day_of_week === day).length
    await insertRoutineExercise(routine.id, exercise.id, day, pos)
    onAdded()
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const id = await insertLocalExercise(newName.trim(), newMuscle.trim() || null)
    const pos = routineExercises.filter(re => re.day_of_week === day).length
    await insertRoutineExercise(routine.id, id, day, pos)
    setNewName('')
    setNewMuscle('')
    onAdded()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 380, maxHeight: '75vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <span>Añadir — {DAYS[day]}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '1rem' }}>
          {Object.keys(grouped).sort().map(group => (
            <div key={group} style={{ marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{group}</p>
              {grouped[group].map(ex => (
                <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>{ex.name}</span>
                  {alreadyAdded.has(ex.id) ? (
                    <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>✓</span>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                      onClick={() => handleAdd(ex)}
                    >
                      Añadir
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}

          {exercises.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: '0.83rem', marginBottom: '1rem' }}>Sin ejercicios todavía.</p>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Nuevo ejercicio</p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <input
                type="text"
                placeholder="Nombre"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.83rem', outline: 'none' }}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Músculo (opcional)"
                  value={newMuscle}
                  onChange={e => { setNewMuscle(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.6rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.83rem', outline: 'none' }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', zIndex: 10, marginTop: 2 }}>
                    {suggestions.map(g => (
                      <div
                        key={g}
                        onMouseDown={() => { setNewMuscle(g); setShowSuggestions(false) }}
                        style={{ padding: '0.35rem 0.6rem', color: 'var(--text-2)', fontSize: '0.83rem', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {g}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '0.1rem' }}>Crear y añadir</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Train View ────────────────────────────────────────────────────────────────

function TrainView({ routine, day, dayExercises, onBack }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [sets, setSets] = useState(() => {
    const init = {}
    dayExercises.forEach(ex => {
      init[ex.local_exercise_id] = [
        { weight: '', reps: '' },
        { weight: '', reps: '' },
        { weight: '', reps: '' },
      ]
    })
    return init
  })
  const [saving, setSaving] = useState(false)

  function updateSet(exerciseId, setIdx, field, value) {
    setSets(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((s, i) => i === setIdx ? { ...s, [field]: value } : s),
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const sessionId = await insertWorkoutSession(routine.id, day, date, null)
      for (const ex of dayExercises) {
        const exSets = sets[ex.local_exercise_id] || []
        for (let i = 0; i < exSets.length; i++) {
          const s = exSets[i]
          if (s.weight && s.reps) {
            await insertWorkoutSet(sessionId, ex.local_exercise_id, i + 1, parseFloat(s.weight), parseInt(s.reps), null)
          }
        }
      }
      onBack()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          ← Volver
        </button>
        <h1 className="page-title">{DAYS[day]}</h1>
        <p className="page-subtitle">{routine.name}</p>
      </div>

      <div style={{ maxWidth: 480 }}>
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-2)', fontSize: '0.85rem', minWidth: 'fit-content' }}>Fecha</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '0.3rem 0.5rem', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
          />
        </div>

        {dayExercises.map(ex => (
          <div key={ex.local_exercise_id} className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.75rem' }}>
              {ex.muscle_group && (
                <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: '0.72rem', marginRight: '0.4rem' }}>[{ex.muscle_group}]</span>
              )}
              {ex.exercise_name}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '3.5rem 1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span />
              <span style={{ color: 'var(--text-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reps</span>
              <span style={{ color: 'var(--text-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kg</span>
            </div>

            {(sets[ex.local_exercise_id] || []).map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '3.5rem 1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Serie {i + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={s.reps}
                  onChange={e => updateSet(ex.local_exercise_id, i, 'reps', e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="—"
                  value={s.weight}
                  onChange={e => updateSet(ex.local_exercise_id, i, 'weight', e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
        ))}

        {dayExercises.length === 0 && (
          <p className="hint">Sin ejercicios en este día.</p>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', padding: '0.7rem', fontSize: '0.88rem' }}
          onClick={handleSave}
          disabled={saving || dayExercises.length === 0}
        >
          {saving ? 'Guardando...' : 'Guardar sesión'}
        </button>
      </div>
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>Confirmar</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', padding: '1rem 1rem 0' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '1rem' }}>
          <button className="btn-cancel" onClick={onCancel}>Cancelar</button>
          <button className="btn-delete" onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  )
}
