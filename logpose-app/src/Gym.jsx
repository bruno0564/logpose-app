import { useState, useEffect, useCallback, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  getRoutines, insertLocalRoutine, updateLocalRoutine, deleteLocalRoutine, purgeLocalRoutine,
  getUnsyncedRoutines, getPendingDeleteRoutines,
  markRoutineSynced, upsertRoutineFromServer, pruneStaleRoutines,
  getExercises, insertLocalExercise, updateLocalExercise,
  getUnsyncedExercises, getPendingDeleteExercises, markExerciseSynced, upsertExerciseFromServer, purgeLocalExercise, pruneStaleExercises,
  getAllRoutineExercises,
  insertRoutineExercise, deleteRoutineExercise,
  getUnsyncedRoutineExercises, getPendingDeleteRoutineExercises, markRoutineExerciseSynced, purgeLocalRoutineExercise, upsertRoutineExerciseFromServer, pruneStaleRoutineExercises,
  insertWorkoutSession, insertWorkoutSet,
  getActiveRoutine, setActiveRoutine,
  getAllSessions, getSetsForSession, getExerciseProgression,
  getUnsyncedSessions, getPendingDeleteSessions, markSessionSynced, purgeLocalSession, upsertSessionFromServer,
  getUnsyncedSets, getPendingDeleteSets, markSetSynced, purgeLocalSet, upsertSetFromServer,
} from './db/database'
import {
  isServerReachable,
  fetchAllRoutinesFromServer, postRoutineToServer, putRoutineToServer, deleteRoutineFromServer,
  fetchAllExercisesFromServer, postExerciseToServer, putExerciseToServer, deleteExerciseFromServer,
  fetchAllRoutineExercisesFromServer, postRoutineExerciseToServer, deleteRoutineExerciseFromServer,
  fetchAllSessionsFromServer, fetchAllSetsFromServer, deleteSessionFromServer, deleteSetFromServer,
  postSessionToServer, postSetToServer,
} from './api/client'
import { useLang } from './LangContext.jsx'
import { IconEdit, IconClose, IconCheck, IconChevronDown, IconChevronUp } from './Icons.jsx'

let syncingGym = false

export default function Gym() {
  const { t: tr } = useLang()
  const selectedRoutineRef = useRef(null)

  const [view, setView] = useState('routines')
  const [routines, setRoutines] = useState([])
  const [activeRoutineId, setActiveRoutineId] = useState(null)
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [routineExercises, setRoutineExercises] = useState([])
  const [exercises, setExercises] = useState([])
  const [tab, setTab] = useState('routines')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [editingRoutineId, setEditingRoutineId] = useState(null)
  const [editRoutineName, setEditRoutineName] = useState('')

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

  useEffect(() => { selectedRoutineRef.current = selectedRoutine }, [selectedRoutine])

  const syncGym = useCallback(async () => {
    if (syncingGym) return
    syncingGym = true
    try {
      if (!await isServerReachable()) return

      for (const r of await getPendingDeleteRoutines()) {
        try { await deleteRoutineFromServer(r.server_id) } catch {}
        await purgeLocalRoutine(r.id)
      }
      for (const r of await getUnsyncedRoutines()) {
        if (r.server_id) {
          await putRoutineToServer(r.server_id, r)
          await markRoutineSynced(r.id, r.server_id)
        } else {
          const created = await postRoutineToServer(r)
          await markRoutineSynced(r.id, created.id)
        }
      }
      const serverRoutines = await fetchAllRoutinesFromServer()
      for (const r of serverRoutines) await upsertRoutineFromServer(r)
      await pruneStaleRoutines(new Set(serverRoutines.map(r => r.id)))

      for (const ex of await getPendingDeleteExercises()) {
        try { await deleteExerciseFromServer(ex.server_id) } catch {}
        await purgeLocalExercise(ex.id)
      }
      for (const ex of await getUnsyncedExercises()) {
        if (ex.server_id) {
          await putExerciseToServer(ex.server_id, ex)
          await markExerciseSynced(ex.id, ex.server_id)
        } else {
          const created = await postExerciseToServer(ex)
          await markExerciseSynced(ex.id, created.id)
        }
      }
      const serverExercises = await fetchAllExercisesFromServer()
      for (const ex of serverExercises) await upsertExerciseFromServer(ex)
      await pruneStaleExercises(new Set(serverExercises.map(e => e.id)))

      for (const re of await getPendingDeleteRoutineExercises()) {
        try { await deleteRoutineExerciseFromServer(re.server_id) } catch {}
        await purgeLocalRoutineExercise(re.id)
      }
      for (const re of await getUnsyncedRoutineExercises()) {
        const created = await postRoutineExerciseToServer(re)
        await markRoutineExerciseSynced(re.id, created.id)
      }
      const serverREs = await fetchAllRoutineExercisesFromServer()
      for (const re of serverREs) await upsertRoutineExerciseFromServer(re)
      await pruneStaleRoutineExercises(new Set(serverREs.map(r => r.id)))

      for (const s of await getPendingDeleteSessions()) {
        try { await deleteSessionFromServer(s.server_id) } catch {}
        await purgeLocalSession(s.id)
      }
      for (const s of await getUnsyncedSessions()) {
        const created = await postSessionToServer(s)
        await markSessionSynced(s.id, created.id)
      }
      const serverSessions = await fetchAllSessionsFromServer()
      for (const s of serverSessions) await upsertSessionFromServer(s)

      for (const ws of await getPendingDeleteSets()) {
        try { await deleteSetFromServer(ws.server_id) } catch {}
        await purgeLocalSet(ws.id)
      }
      for (const ws of await getUnsyncedSets()) {
        const created = await postSetToServer(ws)
        await markSetSynced(ws.id, created.id)
      }
      const serverSets = await fetchAllSetsFromServer()
      for (const ws of serverSets) await upsertSetFromServer(ws)

    } catch {} finally {
      syncingGym = false
      await loadRoutines()
      await loadExercises()
      if (selectedRoutineRef.current) await loadRoutineExercises(selectedRoutineRef.current)
    }
  }, [loadRoutines, loadExercises, loadRoutineExercises])

  useEffect(() => {
    loadRoutines().then(() => syncGym())
    loadExercises()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    await insertLocalRoutine(newName.trim())
    setNewName('')
    setAdding(false)
    await loadRoutines()
    syncGym()
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
    syncGym()
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
        onSynced={syncGym}
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
          message={tr('gym.confirmDeleteRoutine', { name: confirmTarget.name })}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="page-title">{tr('gym.title')}</h1>
          {tab === 'routines' && <button className="btn-primary" onClick={() => setAdding(a => !a)}>{tr('gym.addRoutine')}</button>}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '0.2rem', width: 'fit-content' }}>
          {['routines', 'stats'].map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)} style={{ padding: '0.3rem 1rem', fontSize: '0.82rem', fontWeight: 500, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: tab === tabKey ? 'var(--accent)' : 'transparent', color: tab === tabKey ? '#fff' : 'var(--text-2)', transition: 'all 0.15s' }}>
              {tabKey === 'routines' ? tr('gym.tabRoutines') : tr('gym.tabStats')}
            </button>
          ))}
        </div>
      </div>

      {tab === 'stats' && <StatsView exercises={exercises} />}

      {tab === 'routines' && adding && (
        <div className="card" style={{ marginBottom: '1.25rem', maxWidth: 400 }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <input
              autoFocus
              type="text"
              placeholder={tr('gym.routineNamePh')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: '0.5rem 0.75rem',
                background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontSize: '0.85rem', outline: 'none',
              }}
            />
            <button type="submit" className="btn-primary">{tr('common.create')}</button>
            <button type="button" className="btn-cancel" onClick={() => { setAdding(false); setNewName('') }}>
              {tr('common.cancel')}
            </button>
          </form>
        </div>
      )}

      {tab === 'routines' && routines.length === 0 && (
        <p className="hint">{tr('gym.noRoutines')}</p>
      )}
      {tab === 'routines' && routines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 480 }}>
          {routines.map(r => {
            const isActive = r.id === activeRoutineId
            return (
              <div
                key={r.id}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 0, padding: '1rem 1.25rem',
                  cursor: editingRoutineId === r.id ? 'default' : 'pointer',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onClick={() => editingRoutineId !== r.id && openRoutine(r)}
              >
                {editingRoutineId === r.id ? (
                  <form
                    onSubmit={async e => {
                      e.preventDefault()
                      if (!editRoutineName.trim()) return
                      await updateLocalRoutine(r.id, editRoutineName.trim())
                      setEditingRoutineId(null)
                      await loadRoutines()
                      syncGym()
                    }}
                    style={{ display: 'flex', gap: '0.5rem', width: '100%' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={editRoutineName}
                      onChange={e => setEditRoutineName(e.target.value)}
                      style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.65rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
                    />
                    <button type="submit" className="btn-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', height: 'auto' }}>{tr('common.save')}</button>
                    <button type="button" className="btn-cancel" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', height: 'auto' }} onClick={e => { e.stopPropagation(); setEditingRoutineId(null) }}>{tr('common.cancel')}</button>
                  </form>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {isActive && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {tr('gym.activeBadge')}
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
                          {tr('gym.activateBtn')}
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={e => { e.stopPropagation(); setEditingRoutineId(r.id); setEditRoutineName(r.name) }}
                      >
                        <IconEdit />
                      </button>
                      <button className="btn-delete" onClick={e => { e.stopPropagation(); handleDelete(r) }}><IconClose /></button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Stats View ────────────────────────────────────────────────────────────────

function StatsView({ exercises }) {
  const { t: tr, tp } = useLang()
  const [sessions, setSessions] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [sessionSets, setSessionSets] = useState({})
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [progression, setProgression] = useState([])
  const days = tr('common.days')

  useEffect(() => {
    getAllSessions().then(setSessions)
  }, [])

  async function toggleSession(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!sessionSets[id]) {
      const sets = await getSetsForSession(id)
      setSessionSets(prev => ({ ...prev, [id]: sets }))
    }
  }

  async function handleSelectExercise(ex) {
    setSelectedExercise(ex)
    const data = await getExerciseProgression(ex.id)
    setProgression(data)
  }

  return (
    <div>
      {sessions.length === 0 && (
        <p className="hint">{tr('gym.noSessions')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 520, marginBottom: '2rem' }}>
        {sessions.map(s => {
          const isOpen = expanded === s.id
          const sets = sessionSets[s.id] || []
          const exGroups = sets.reduce((acc, ws) => {
            if (!acc[ws.exercise_name]) acc[ws.exercise_name] = []
            acc[ws.exercise_name].push(ws)
            return acc
          }, {})

          return (
            <div key={s.id} className="card" style={{ marginBottom: 0, padding: 0, overflow: 'hidden' }}>
              <div
                onClick={() => toggleSession(s.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.25rem', cursor: 'pointer' }}
              >
                <div>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{s.date}</span>
                  {s.routine_name && <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{s.routine_name}{s.day_of_week != null ? ` · ${days[s.day_of_week]}` : ''}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{tp('gym.sets', s.set_count)}</span>
                  {isOpen ? <IconChevronUp /> : <IconChevronDown />}
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '0.75rem 1.25rem 1rem' }}>
                  {Object.entries(exGroups).map(([name, exSets]) => (
                    <div key={name} style={{ marginBottom: '0.75rem' }}>
                      <p style={{ color: 'var(--text-2)', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>{name}</p>
                      {exSets.map(ws => (
                        <div key={ws.id} style={{ display: 'flex', gap: '1rem', color: 'var(--text-3)', fontSize: '0.78rem', paddingLeft: '0.5rem' }}>
                          <span>{tr('gym.serieLabel', { n: ws.set_number })}</span>
                          <span>{ws.weight} kg</span>
                          <span>{ws.reps} reps</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {exercises.length > 0 && (
        <div style={{ maxWidth: 520 }}>
          <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>{tr('gym.progressionTitle')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
            {exercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => handleSelectExercise(ex)}
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selectedExercise?.id === ex.id ? 'var(--accent)' : 'var(--surface-2)', color: selectedExercise?.id === ex.id ? '#fff' : 'var(--text-2)' }}
              >
                {ex.name}
              </button>
            ))}
          </div>

          {selectedExercise && progression.length === 0 && (
            <p className="hint">{tr('gym.noDataExercise', { name: selectedExercise.name })}</p>
          )}
          {selectedExercise && progression.length > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <p style={{ color: 'var(--text-2)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{tr('gym.maxWeight', { name: selectedExercise.name })}</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={progression}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} width={35} />
                  <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12 }} formatter={(v) => [`${v} kg`, 'Max']} />
                  <Line type="monotone" dataKey="max_weight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Routine Detail ────────────────────────────────────────────────────────────

function RoutineDetailView({ routine, routineExercises, exercises, onBack, onTrain, onExercisesChange, onExercisesListChange }) {
  const { t: tr } = useLang()
  const [pickerDay, setPickerDay] = useState(null)
  const days = tr('common.days')

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
          {tr('common.back')}
        </button>
        <h1 className="page-title">{routine.name}</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 480 }}>
        {days.map((dayName, idx) => {
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
                      {tr('gym.trainBtn')}
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
                <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>{tr('gym.restDay')}</span>
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
                        className="btn-delete"
                        onClick={async () => { await deleteRoutineExercise(re.id); onExercisesChange() }}
                      >
                        <IconClose size={12} />
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

const MUSCLE_SUBGROUPS = {
  'Pecho':     ['Superior', 'Inferior', 'Medio'],
  'Espalda':   ['Dorsal', 'Trapecio', 'Lumbar'],
  'Hombro':    ['Anterior', 'Lateral', 'Posterior'],
  'Bíceps':    ['Cabeza corta', 'Cabeza larga'],
  'Tríceps':   ['Cabeza larga', 'Cabeza lateral', 'Cabeza media'],
  'Pierna':    ['Cuádriceps', 'Isquiotibiales', 'Glúteo', 'Gemelo'],
  'Abdomen':   ['Superior', 'Inferior', 'Oblicuos'],
  'Antebrazo': ['Flexores', 'Extensores'],
}

function ExercisePickerModal({ day, routine, exercises, routineExercises, onClose, onAdded }) {
  const { t: tr } = useLang()
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState('')
  const [newSubgroup, setNewSubgroup] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [editingExId, setEditingExId] = useState(null)
  const [editExName, setEditExName] = useState('')
  const [editExMuscle, setEditExMuscle] = useState('')
  const [editExSubgroup, setEditExSubgroup] = useState('')

  const muscleGroups = [...new Set(exercises.map(e => e.muscle_group).filter(Boolean))].sort()
  const suggestions = muscleGroups.filter(g =>
    g.toLowerCase().includes(newMuscle.toLowerCase()) && g.toLowerCase() !== newMuscle.toLowerCase()
  )
  const subgroups = MUSCLE_SUBGROUPS[newMuscle] ?? []
  const days = tr('common.days')
  const noGroup = tr('gym.noGroup')

  const alreadyAdded = new Set(
    routineExercises.filter(re => re.day_of_week === day).map(re => re.local_exercise_id)
  )

  const grouped = exercises.reduce((acc, ex) => {
    const g = ex.muscle_group || noGroup
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
    const id = await insertLocalExercise(newName.trim(), newMuscle.trim() || null, newSubgroup || null)
    const pos = routineExercises.filter(re => re.day_of_week === day).length
    await insertRoutineExercise(routine.id, id, day, pos)
    setNewName('')
    setNewMuscle('')
    setNewSubgroup('')
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
          <span>{tr('gym.addTitle', { day: days[day] })}</span>
          <button onClick={onClose} className="btn-delete"><IconClose /></button>
        </div>

        <div style={{ padding: '1rem' }}>
          {Object.keys(grouped).sort().map(group => (
            <div key={group} style={{ marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{group}</p>
              {grouped[group].map(ex => {
                if (editingExId === ex.id) {
                  return (
                    <div key={ex.id} style={{ padding: '0.3rem 0' }}>
                      <form
                        onSubmit={async e => {
                          e.preventDefault()
                          if (!editExName.trim()) return
                          await updateLocalExercise(ex.id, editExName.trim(), editExMuscle || null, editExSubgroup || null)
                          setEditingExId(null)
                          onAdded()
                        }}
                        style={{ display: 'flex', gap: '0.3rem' }}
                      >
                        <input
                          autoFocus
                          value={editExName}
                          onChange={e => setEditExName(e.target.value)}
                          style={{ flex: 1, minWidth: 0, padding: '0.3rem 0.5rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                        />
                        <button type="submit" className="btn-primary" style={{ padding: '0.2rem 0.5rem' }}><IconCheck size={12} /></button>
                        <button type="button" className="btn-cancel" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setEditingExId(null)}><IconClose size={12} /></button>
                      </form>
                    </div>
                  )
                }
                return (
                  <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>{ex.name}</span>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button
                        className="btn-icon"
                        onClick={() => { setEditingExId(ex.id); setEditExName(ex.name); setEditExMuscle(ex.muscle_group || ''); setEditExSubgroup(ex.muscle_subgroup || '') }}
                      >
                        <IconEdit size={13} />
                      </button>
                      {alreadyAdded.has(ex.id) ? (
                        <IconCheck size={13} style={{ color: 'var(--success)' }} />
                      ) : (
                        <button
                          className="btn-primary"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                          onClick={() => handleAdd(ex)}
                        >
                          {tr('gym.addExercise')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {exercises.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: '0.83rem', marginBottom: '1rem' }}>{tr('gym.noExercisesYet')}</p>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{tr('gym.newExercise')}</p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <input
                type="text"
                placeholder={tr('gym.exerciseNamePh')}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.83rem', outline: 'none' }}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={tr('gym.musclePh')}
                  value={newMuscle}
                  onChange={e => { setNewMuscle(e.target.value); setNewSubgroup(''); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.6rem', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.83rem', outline: 'none' }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', zIndex: 10, marginTop: 2 }}>
                    {suggestions.map(g => (
                      <div
                        key={g}
                        onMouseDown={() => { setNewMuscle(g); setNewSubgroup(''); setShowSuggestions(false) }}
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
              {subgroups.length > 0 && (
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {subgroups.map(sg => (
                    <button
                      key={sg}
                      type="button"
                      onClick={() => setNewSubgroup(newSubgroup === sg ? '' : sg)}
                      style={{
                        padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: 600,
                        borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        background: newSubgroup === sg ? '#7c3aed' : 'var(--surface-2)',
                        color: newSubgroup === sg ? '#fff' : 'var(--text-3)',
                        transition: 'background 0.15s',
                      }}
                    >
                      {sg}
                    </button>
                  ))}
                </div>
              )}
              <button type="submit" className="btn-primary" style={{ marginTop: '0.1rem' }}>{tr('gym.createAndAdd')}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Train View ────────────────────────────────────────────────────────────────

function TrainView({ routine, day, dayExercises, onBack, onSynced }) {
  const { t: tr } = useLang()
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
  const days = tr('common.days')

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
      onSynced?.()
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
          {tr('common.back')}
        </button>
        <h1 className="page-title">{days[day]}</h1>
        <p className="page-subtitle">{routine.name}</p>
      </div>

      <div style={{ maxWidth: 480 }}>
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-2)', fontSize: '0.85rem', minWidth: 'fit-content' }}>{tr('common.date')}</span>
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
              <span style={{ color: 'var(--text-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('gym.reps')}</span>
              <span style={{ color: 'var(--text-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('gym.kg')}</span>
            </div>

            {(sets[ex.local_exercise_id] || []).map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '3.5rem 1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{tr('gym.serieLabel', { n: i + 1 })}</span>
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
          <p className="hint">{tr('gym.noExercisesDay')}</p>
        )}

        <button
          className="btn-primary"
          style={{ width: '100%', padding: '0.7rem', fontSize: '0.88rem' }}
          onClick={handleSave}
          disabled={saving || dayExercises.length === 0}
        >
          {saving ? tr('gym.savingSession') : tr('gym.saveSession')}
        </button>
      </div>
    </div>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel }) {
  const { t: tr } = useLang()
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>{tr('common.confirm')}</span>
          <button onClick={onCancel} className="btn-delete"><IconClose /></button>
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', padding: '1rem 1rem 0' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '1rem' }}>
          <button className="btn-cancel" onClick={onCancel}>{tr('common.cancel')}</button>
          <button className="btn-delete" onClick={onConfirm}>{tr('common.delete')}</button>
        </div>
      </div>
    </div>
  )
}
