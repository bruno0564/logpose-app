import { useState, useCallback, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import {
  getRoutines, insertLocalRoutine, deleteLocalRoutine, purgeLocalRoutine,
  getUnsyncedRoutines, getPendingDeleteRoutines,
  markRoutineSynced, upsertRoutineFromServer, pruneStaleRoutines,
  getExercises, insertLocalExercise,
  getAllRoutineExercises,
  insertRoutineExercise, deleteRoutineExercise,
  insertWorkoutSession, insertWorkoutSet,
  getActiveRoutine, setActiveRoutine,
  getAllSessions, getSetsForSession, getExerciseProgression,
} from '../db/database'
import {
  isServerReachable,
  fetchAllRoutinesFromServer, postRoutineToServer, deleteRoutineFromServer,
} from '../api/client'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

let syncingRoutines = false

export default function GymScreen() {
  const [view, setView] = useState('routines')
  const [tab, setTab] = useState('routines')
  const [routines, setRoutines] = useState([])
  const [activeRoutineId, setActiveRoutineId] = useState(null)
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [routineExercises, setRoutineExercises] = useState([])
  const [exercises, setExercises] = useState([])
  const [adding, setAdding] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [newName, setNewName] = useState('')

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

  useFocusEffect(
    useCallback(() => {
      loadRoutines().then(() => syncRoutines())
      loadExercises()
    }, [loadRoutines, syncRoutines, loadExercises])
  )

  async function handleAdd() {
    if (!newName.trim()) return
    await insertLocalRoutine(newName.trim())
    setNewName('')
    setAdding(false)
    await loadRoutines()
    syncRoutines()
  }

  async function handleActivate(r) {
    await setActiveRoutine(r.id)
    setActiveRoutineId(r.id)
  }

  function handleDelete(r) {
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
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ConfirmModal
        visible={confirmTarget !== null}
        message={confirmTarget ? `¿Eliminar la rutina "${confirmTarget.name}"?` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
      <View style={s.header}>
        <Text style={s.title}>Gym</Text>
        {tab === 'routines' && (
          <TouchableOpacity style={s.btnPrimary} onPress={() => setAdding(a => !a)}>
            <Text style={s.btnPrimaryText}>+ Rutina</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.tabBar}>
        {['routines', 'stats'].map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
              {t === 'routines' ? 'Rutinas' : 'Estadísticas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'stats' && <StatsView exercises={exercises} />}

      {tab === 'routines' && (
        <>
          <Text style={s.subtitle}>Tus rutinas de entrenamiento</Text>

          {adding && (
            <View style={s.card}>
              <TextInput
                autoFocus
                style={s.input}
                placeholder="Nombre de la rutina..."
                placeholderTextColor="#444"
                value={newName}
                onChangeText={setNewName}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[s.btnPrimary, { flex: 1 }]} onPress={handleAdd}>
                  <Text style={s.btnPrimaryText}>Crear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnCancel, { flex: 1 }]} onPress={() => { setAdding(false); setNewName('') }}>
                  <Text style={s.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {routines.length === 0 ? (
            <Text style={s.hint}>Sin rutinas todavía. Crea la primera arriba.</Text>
          ) : (
            routines.map(r => {
              const isActive = r.id === activeRoutineId
              return (
                <TouchableOpacity key={r.id} style={[s.rowCard, { borderLeftWidth: 3, borderLeftColor: isActive ? '#818cf8' : 'transparent' }]} onPress={() => openRoutine(r)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowText}>{r.name}</Text>
                    {isActive && <Text style={{ color: '#818cf8', fontSize: 11, marginTop: 2 }}>Activa</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {!isActive && (
                      <TouchableOpacity onPress={() => handleActivate(r)} hitSlop={10}>
                        <Text style={{ color: '#444', fontSize: 12 }}>Activar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDelete(r)} hitSlop={10}>
                      <Text style={s.deleteBtn}>×</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </>
      )}
    </ScrollView>
  )
}

// ── Stats View ────────────────────────────────────────────────────────────────

function StatsView({ exercises }) {
  const [sessions, setSessions] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [sessionSets, setSessionSets] = useState({})
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [progression, setProgression] = useState([])

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

  const screenWidth = Dimensions.get('window').width - 32

  const chartData = progression.length > 0 ? {
    labels: progression.map(p => p.date.slice(5)),
    datasets: [{ data: progression.map(p => p.max_weight) }],
  } : null

  return (
    <View>
      {sessions.length === 0 && (
        <Text style={[s.hint, { marginTop: 8 }]}>Sin sesiones todavía. Empieza a entrenar desde Rutinas.</Text>
      )}

      {sessions.map(session => {
        const isOpen = expanded === session.id
        const sets = sessionSets[session.id] || []
        const exGroups = sets.reduce((acc, ws) => {
          if (!acc[ws.exercise_name]) acc[ws.exercise_name] = []
          acc[ws.exercise_name].push(ws)
          return acc
        }, {})

        return (
          <View key={session.id} style={[s.card, { padding: 0, overflow: 'hidden', marginBottom: 6 }]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
              onPress={() => toggleSession(session.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f0f0f0', fontWeight: '600', fontSize: 14 }}>{session.date}</Text>
                {session.routine_name && (
                  <Text style={{ color: '#444', fontSize: 11, marginTop: 2 }}>
                    {session.routine_name}{session.day_of_week != null ? ` · ${DAYS[session.day_of_week]}` : ''}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: '#444', fontSize: 11 }}>{session.set_count} series</Text>
                <Text style={{ color: '#444', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {isOpen && (
              <View style={{ borderTopWidth: 1, borderTopColor: '#1e1e1e', padding: 14, paddingTop: 10 }}>
                {Object.entries(exGroups).map(([name, exSets]) => (
                  <View key={name} style={{ marginBottom: 10 }}>
                    <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{name}</Text>
                    {exSets.map(ws => (
                      <View key={ws.id} style={{ flexDirection: 'row', gap: 16, paddingLeft: 8, paddingVertical: 2 }}>
                        <Text style={{ color: '#444', fontSize: 12 }}>Serie {ws.set_number}</Text>
                        <Text style={{ color: '#444', fontSize: 12 }}>{ws.weight} kg</Text>
                        <Text style={{ color: '#444', fontSize: 12 }}>{ws.reps} reps</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        )
      })}

      {exercises.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Progresión por ejercicio</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {exercises.map(ex => (
              <TouchableOpacity
                key={ex.id}
                style={[s.btnCancel, { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: selectedExercise?.id === ex.id ? '#818cf8' : '#2a2a2a', backgroundColor: selectedExercise?.id === ex.id ? '#818cf8' : '#181818' }]}
                onPress={() => handleSelectExercise(ex)}
              >
                <Text style={{ color: selectedExercise?.id === ex.id ? '#fff' : '#888', fontSize: 12 }}>{ex.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedExercise && progression.length === 0 && (
            <Text style={s.hint}>Sin datos para {selectedExercise.name} todavía.</Text>
          )}
          {selectedExercise && chartData && (
            <View style={s.card}>
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>{selectedExercise.name} — peso máximo (kg)</Text>
              <LineChart
                data={chartData}
                width={screenWidth - 28}
                height={160}
                chartConfig={{
                  backgroundColor: '#111',
                  backgroundGradientFrom: '#111',
                  backgroundGradientTo: '#111',
                  decimalPlaces: 1,
                  color: () => '#818cf8',
                  labelColor: () => '#444',
                  propsForDots: { r: '3', strokeWidth: '1', stroke: '#818cf8' },
                }}
                bezier
                style={{ borderRadius: 8, marginLeft: -16 }}
                withInnerLines={false}
              />
            </View>
          )}
        </View>
      )}
    </View>
  )
}

// ── Routine Detail ────────────────────────────────────────────────────────────

function RoutineDetailView({ routine, routineExercises, exercises, onBack, onTrain, onExercisesChange, onExercisesListChange }) {
  const [pickerDay, setPickerDay] = useState(null)

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ExercisePickerModal
        visible={pickerDay !== null}
        day={pickerDay}
        routine={routine}
        exercises={exercises}
        routineExercises={routineExercises}
        onClose={() => setPickerDay(null)}
        onAdded={() => { onExercisesChange(); onExercisesListChange() }}
      />

      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
        <Text style={s.backBtn}>← Volver</Text>
      </TouchableOpacity>
      <Text style={s.title}>{routine.name}</Text>
      <View style={{ height: 16 }} />

      {DAYS.map((dayName, idx) => {
        const dayExs = routineExercises.filter(re => re.day_of_week === idx)
        return (
          <View key={idx} style={[s.card, { marginBottom: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: dayExs.length > 0 ? 8 : 0 }}>
              <Text style={s.dayName}>{dayName}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {dayExs.length > 0 && (
                  <TouchableOpacity style={s.btnPrimary} onPress={() => onTrain(idx)}>
                    <Text style={s.btnPrimaryText}>Entrenar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.btnOutline} onPress={() => setPickerDay(idx)}>
                  <Text style={s.btnOutlineText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {dayExs.length === 0 ? (
              <Text style={s.restText}>Descanso</Text>
            ) : (
              dayExs.map(re => (
                <View key={re.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={s.exerciseName}>
                    {re.muscle_group ? `[${re.muscle_group}] ` : ''}{re.exercise_name}
                  </Text>
                  <TouchableOpacity onPress={async () => { await deleteRoutineExercise(re.id); onExercisesChange() }} hitSlop={10}>
                    <Text style={s.deleteSmall}>×</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

// ── Exercise Picker Modal ────────────────────────────────────────────────────

function ExercisePickerModal({ visible, day, routine, exercises, routineExercises, onClose, onAdded }) {
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const muscleGroups = [...new Set(exercises.map(e => e.muscle_group).filter(Boolean))].sort()
  const suggestions = muscleGroups.filter(g =>
    g.toLowerCase().includes(newMuscle.toLowerCase()) && g.toLowerCase() !== newMuscle.toLowerCase()
  )

  if (day === null) return null

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

  async function handleCreate() {
    if (!newName.trim()) return
    const id = await insertLocalExercise(newName.trim(), newMuscle.trim() || null)
    const pos = routineExercises.filter(re => re.day_of_week === day).length
    await insertRoutineExercise(routine.id, id, day, pos)
    setNewName('')
    setNewMuscle('')
    onAdded()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Añadir — {DAYS[day]}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={s.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }}>
            {Object.keys(grouped).sort().map(group => (
              <View key={group} style={{ marginBottom: 14 }}>
                <Text style={s.groupLabel}>{group}</Text>
                {grouped[group].map(ex => (
                  <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 }}>
                    <Text style={s.exerciseName}>{ex.name}</Text>
                    {alreadyAdded.has(ex.id) ? (
                      <Text style={s.addedMark}>✓</Text>
                    ) : (
                      <TouchableOpacity style={s.btnPrimarySmall} onPress={() => handleAdd(ex)}>
                        <Text style={s.btnPrimaryText}>Añadir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ))}

            {exercises.length === 0 && (
              <Text style={s.hint}>Sin ejercicios todavía.</Text>
            )}

            <View style={s.divider} />
            <Text style={[s.hint, { marginBottom: 6 }]}>Nuevo ejercicio</Text>
            <TextInput
              style={s.input}
              placeholder="Nombre"
              placeholderTextColor="#444"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[s.input, { marginTop: 6 }]}
              placeholder="Músculo (opcional)"
              placeholderTextColor="#444"
              value={newMuscle}
              onChangeText={v => { setNewMuscle(v); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setShowSuggestions(false)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 6, marginTop: 2, overflow: 'hidden' }}>
                {suggestions.map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => { setNewMuscle(g); setShowSuggestions(false) }}
                    style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' }}
                  >
                    <Text style={{ color: '#888', fontSize: 13 }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity style={[s.btnPrimary, { marginTop: 8 }]} onPress={handleCreate}>
              <Text style={s.btnPrimaryText}>Crear y añadir</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={s.backBtn}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>{DAYS[day]}</Text>
        <Text style={s.subtitle}>{routine.name}</Text>
        <View style={{ height: 16 }} />

        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }]}>
          <Text style={s.hint}>Fecha</Text>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#444"
          />
        </View>

        {dayExercises.map(ex => (
          <View key={ex.local_exercise_id} style={[s.card, { marginBottom: 12 }]}>
            <Text style={s.dayName}>
              {ex.muscle_group ? `[${ex.muscle_group}] ` : ''}{ex.exercise_name}
            </Text>

            <View style={{ flexDirection: 'row', marginTop: 10, marginBottom: 4 }}>
              <View style={{ width: 60 }} />
              <Text style={[s.colHeader, { flex: 1 }]}>Reps</Text>
              <Text style={[s.colHeader, { flex: 1 }]}>Kg</Text>
            </View>

            {(sets[ex.local_exercise_id] || []).map((setData, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[s.restText, { width: 60 }]}>Serie {i + 1}</Text>
                <TextInput
                  style={[s.input, { flex: 1, marginRight: 6 }]}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor="#444"
                  value={setData.reps}
                  onChangeText={v => updateSet(ex.local_exercise_id, i, 'reps', v)}
                />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor="#444"
                  value={setData.weight}
                  onChangeText={v => updateSet(ex.local_exercise_id, i, 'weight', v)}
                />
              </View>
            ))}
          </View>
        ))}

        {dayExercises.length === 0 && (
          <Text style={s.hint}>Sin ejercicios en este día.</Text>
        )}

        <TouchableOpacity
          style={[s.btnPrimary, { paddingVertical: 13, opacity: saving || dayExercises.length === 0 ? 0.5 : 1 }]}
          onPress={handleSave}
          disabled={saving || dayExercises.length === 0}
        >
          <Text style={[s.btnPrimaryText, { textAlign: 'center', fontSize: 15 }]}>
            {saving ? 'Guardando...' : 'Guardar sesión'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ visible, message, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Confirmar</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={10}>
              <Text style={s.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: '#888', fontSize: 14, padding: 16, paddingTop: 8 }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingTop: 0, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={s.btnCancel} onPress={onCancel}>
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: '#7f1d1d', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 }} onPress={onConfirm}>
              <Text style={{ color: '#fca5a5', fontSize: 13, fontWeight: '600' }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: '#0a0a0a', padding: 16, paddingTop: 54 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tabBar:          { flexDirection: 'row', backgroundColor: '#111', borderRadius: 8, padding: 3, marginBottom: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  tabBtn:          { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  tabBtnActive:    { backgroundColor: '#818cf8' },
  tabBtnText:      { color: '#444', fontSize: 13, fontWeight: '500' },
  tabBtnTextActive:{ color: '#fff', fontWeight: '600' },
  title:           { color: '#f0f0f0', fontSize: 22, fontWeight: '700' },
  subtitle:        { color: '#888', fontSize: 13, marginBottom: 20 },
  hint:            { color: '#444', fontSize: 13 },
  backBtn:         { color: '#818cf8', fontSize: 14, marginBottom: 2 },
  card:            { backgroundColor: '#111', borderRadius: 10, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: '#1e1e1e' },
  rowCard:         { backgroundColor: '#111', borderRadius: 10, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: '#1e1e1e', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText:         { color: '#f0f0f0', fontSize: 14, fontWeight: '500' },
  deleteBtn:       { color: '#444', fontSize: 20, lineHeight: 22 },
  deleteSmall:     { color: '#444', fontSize: 18, lineHeight: 20, paddingHorizontal: 4 },
  dayName:         { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  restText:        { color: '#444', fontSize: 12 },
  exerciseName:    { color: '#888', fontSize: 13, flex: 1, marginRight: 8 },
  groupLabel:      { color: '#444', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  addedMark:       { color: '#444', fontSize: 13 },
  colHeader:       { color: '#444', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  input:           { backgroundColor: '#181818', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 6, color: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  btnPrimary:      { backgroundColor: '#818cf8', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' },
  btnPrimarySmall: { backgroundColor: '#818cf8', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  btnPrimaryText:  { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnCancel:       { backgroundColor: '#1e1e1e', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' },
  btnCancelText:   { color: '#888', fontSize: 13 },
  btnOutline:      { borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  btnOutlineText:  { color: '#888', fontSize: 16, lineHeight: 18 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:           { backgroundColor: '#111', borderRadius: 12, padding: 16, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#1e1e1e' },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle:      { color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  closeBtn:        { color: '#888', fontSize: 22, lineHeight: 24 },
  divider:         { height: 1, backgroundColor: '#1e1e1e', marginVertical: 12 },
})
