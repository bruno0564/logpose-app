import { useState, useCallback, useEffect, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, TouchableOpacity, ScrollView,
  Modal, StyleSheet, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import { Ionicons } from '@expo/vector-icons'
import PressableScale from '../components/PressableScale'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'
import DatePicker from '../components/DatePicker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LineChart } from 'react-native-chart-kit'
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
  getActiveRoutine, setActiveRoutine, restoreActiveRoutineByServerId,
  getAllSessions, getSetsForSession, getExerciseProgression,
  getUnsyncedSessions, getPendingDeleteSessions, markSessionSynced, purgeLocalSession, upsertSessionFromServer, pruneStaleSessions,
  getUnsyncedSets, getPendingDeleteSets, markSetSynced, purgeLocalSet, upsertSetFromServer, pruneStaleSets,
} from '../db/database'
import {
  isServerReachable,
  fetchAllRoutinesFromServer, postRoutineToServer, putRoutineToServer, deleteRoutineFromServer,
  fetchAllExercisesFromServer, postExerciseToServer, putExerciseToServer, deleteExerciseFromServer,
  fetchAllRoutineExercisesFromServer, postRoutineExerciseToServer, deleteRoutineExerciseFromServer,
  fetchAllSessionsFromServer, fetchAllSetsFromServer, deleteSessionFromServer, deleteSetFromServer,
  postSessionToServer, postSetToServer,
} from '../api/client'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

let syncingGym = false

export default function GymScreen() {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const selectedRoutineRef = useRef(null)

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

      const savedServerId = await AsyncStorage.getItem('activeRoutineServerId')
      if (savedServerId) await restoreActiveRoutineByServerId(parseInt(savedServerId))

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
      await pruneStaleSessions(new Set(serverSessions.map(s => s.id)))

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
      await pruneStaleSets(new Set(serverSets.map(ws => ws.id)))

    } catch (e) { console.warn('gym sync failed:', e) } finally {
      syncingGym = false
      await loadRoutines()
      await loadExercises()
      if (selectedRoutineRef.current) await loadRoutineExercises(selectedRoutineRef.current)
    }
  }, [loadRoutines, loadExercises, loadRoutineExercises])

  useFocusEffect(
    useCallback(() => {
      loadRoutines().then(() => syncGym())
      loadExercises()
    }, [loadRoutines, syncGym, loadExercises])
  )

  async function handleAdd() {
    if (!newName.trim()) return
    await insertLocalRoutine(newName.trim())
    setNewName('')
    setAdding(false)
    await loadRoutines()
    syncGym()
  }

  async function handleActivate(r) {
    await setActiveRoutine(r.id)
    setActiveRoutineId(r.id)
    if (r.server_id) await AsyncStorage.setItem('activeRoutineServerId', String(r.server_id))
  }

  function handleDelete(r) {
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
    <FadeInView style={s.screen}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ConfirmModal
        visible={confirmTarget !== null}
        message={confirmTarget ? tr('gym.confirmDeleteRoutine', { name: confirmTarget.name }) : ''}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
      <View style={s.header}>
        <Text style={s.title}>{tr('gym.title')}</Text>
        {tab === 'routines' && (
          <PressableScale style={s.btnPrimary} onPress={() => setAdding(a => !a)}>
            <Text style={s.btnPrimaryText}>{tr('gym.addRoutine')}</Text>
          </PressableScale>
        )}
      </View>

      <View style={s.tabBar}>
        {['routines', 'stats'].map(tabKey => (
          <TouchableOpacity key={tabKey} style={[s.tabBtn, tab === tabKey && s.tabBtnActive]} onPress={() => setTab(tabKey)}>
            <Text style={[s.tabBtnText, tab === tabKey && s.tabBtnTextActive]}>
              {tabKey === 'routines' ? tr('gym.tabRoutines') : tr('gym.tabStats')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'stats' && <StatsView exercises={exercises} />}

      {tab === 'routines' && (
        <>
          {adding && (
            <View style={s.card}>
              <TextInput
                autoFocus
                style={s.input}
                placeholder={tr('gym.routineNamePh')}
                placeholderTextColor={t.text3}
                value={newName}
                onChangeText={setNewName}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[s.btnPrimary, { flex: 1 }]} onPress={handleAdd}>
                  <Text style={s.btnPrimaryText}>{tr('common.create')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnCancel, { flex: 1 }]} onPress={() => { setAdding(false); setNewName('') }}>
                  <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {routines.length === 0 ? (
            <Text style={s.hint}>{tr('gym.noRoutines')}</Text>
          ) : (
            routines.map(r => {
              const isActive = r.id === activeRoutineId
              const isEditing = editingRoutineId === r.id
              return (
                <View key={r.id} style={[s.rowCard, { borderLeftWidth: 3, borderLeftColor: isActive ? t.accent : 'transparent' }]}>
                  {isEditing ? (
                    <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        autoFocus
                        style={[s.input, { flex: 1 }]}
                        value={editRoutineName}
                        onChangeText={setEditRoutineName}
                      />
                      <TouchableOpacity
                        style={s.btnPrimary}
                        onPress={async () => {
                          if (!editRoutineName.trim()) return
                          await updateLocalRoutine(r.id, editRoutineName.trim())
                          setEditingRoutineId(null)
                          await loadRoutines()
                          syncGym()
                        }}
                      >
                        <Text style={s.btnPrimaryText}>{tr('common.save')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnCancel} onPress={() => setEditingRoutineId(null)}>
                        <Text style={s.btnCancelText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      onPress={() => openRoutine(r)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowText}>{r.name}</Text>
                        {isActive && <Text style={{ color: t.accent, fontSize: 11, marginTop: 2 }}>{tr('gym.activeBadge')}</Text>}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {!isActive && (
                          <TouchableOpacity onPress={() => handleActivate(r)} hitSlop={10}>
                            <Text style={{ color: t.text3, fontSize: 12 }}>{tr('gym.activateBtn')}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => { setEditingRoutineId(r.id); setEditRoutineName(r.name) }} hitSlop={10}>
                          <Ionicons name="pencil" size={15} color={t.text3} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(r)} hitSlop={10}>
                          <Text style={s.deleteBtn}>×</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })
          )}
        </>
      )}
    </ScrollView>
    </FadeInView>
  )
}

// ── Stats View ────────────────────────────────────────────────────────────────

function StatsView({ exercises }) {
  const { theme: t } = useTheme()
  const { t: tr, tp } = useLang()
  const s = makeStyles(t)
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
  const days = tr('common.days')

  const chartData = progression.length > 0 ? {
    labels: progression.map(p => p.date.slice(5)),
    datasets: [{ data: progression.map(p => p.max_weight) }],
  } : null

  return (
    <View>
      {sessions.length === 0 && (
        <Text style={[s.hint, { marginTop: 8 }]}>{tr('gym.noSessions')}</Text>
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
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{session.date}</Text>
                {session.routine_name && (
                  <Text style={{ color: t.text3, fontSize: 11, marginTop: 2 }}>
                    {session.routine_name}{session.day_of_week != null ? ` · ${days[session.day_of_week]}` : ''}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: t.text3, fontSize: 11 }}>{tp('gym.sets', session.set_count)}</Text>
                <Text style={{ color: t.text3, fontSize: 13 }}>{isOpen ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {isOpen && (
              <View style={{ borderTopWidth: 1, borderTopColor: t.border, padding: 14, paddingTop: 10 }}>
                {Object.entries(exGroups).map(([name, exSets]) => (
                  <View key={name} style={{ marginBottom: 10 }}>
                    <Text style={{ color: t.text2, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{name}</Text>
                    {exSets.map(ws => (
                      <View key={ws.id} style={{ flexDirection: 'row', gap: 16, paddingLeft: 8, paddingVertical: 2 }}>
                        <Text style={{ color: t.text3, fontSize: 12 }}>{tr('gym.serieLabel', { n: ws.set_number })}</Text>
                        {ws.side && ws.side !== 'both' && (
                          <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{ws.side === 'left' ? tr('gym.sideLeft') : tr('gym.sideRight')}</Text>
                        )}
                        <Text style={{ color: t.text3, fontSize: 12 }}>{ws.weight} kg</Text>
                        <Text style={{ color: t.text3, fontSize: 12 }}>{ws.reps} reps</Text>
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
          <Text style={{ color: t.text2, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>{tr('gym.progressionTitle')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {exercises.map(ex => (
              <TouchableOpacity
                key={ex.id}
                style={[s.btnCancel, { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: selectedExercise?.id === ex.id ? t.accent : t.border2, backgroundColor: selectedExercise?.id === ex.id ? t.accent : t.inputBg }]}
                onPress={() => handleSelectExercise(ex)}
              >
                <Text style={{ color: selectedExercise?.id === ex.id ? t.text : t.text2, fontSize: 12 }}>{ex.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedExercise && progression.length === 0 && (
            <Text style={s.hint}>{tr('gym.noDataExercise', { name: selectedExercise.name })}</Text>
          )}
          {selectedExercise && chartData && (
            <View style={s.card}>
              <Text style={{ color: t.text2, fontSize: 12, marginBottom: 10 }}>{tr('gym.maxWeight', { name: selectedExercise.name })}</Text>
              <LineChart
                data={chartData}
                width={screenWidth - 28}
                height={160}
                chartConfig={{
                  backgroundColor: t.surface,
                  backgroundGradientFrom: t.surface,
                  backgroundGradientTo: t.surface,
                  decimalPlaces: 1,
                  color: () => t.accent,
                  labelColor: () => t.text3,
                  propsForDots: { r: '3', strokeWidth: '1', stroke: t.accent },
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
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const [pickerDay, setPickerDay] = useState(null)
  const days = tr('common.days')

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
        <Text style={s.backBtn}>{tr('common.back')}</Text>
      </TouchableOpacity>
      <Text style={s.title}>{routine.name}</Text>
      <View style={{ height: 16 }} />

      {days.map((dayName, idx) => {
        const dayExs = routineExercises.filter(re => re.day_of_week === idx)
        return (
          <View key={idx} style={[s.card, { marginBottom: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: dayExs.length > 0 ? 8 : 0 }}>
              <Text style={s.dayName}>{dayName}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {dayExs.length > 0 && (
                  <PressableScale style={s.btnPrimary} onPress={() => onTrain(idx)}>
                    <Text style={s.btnPrimaryText}>{tr('gym.trainBtn')}</Text>
                  </PressableScale>
                )}
                <PressableScale style={s.btnOutline} onPress={() => setPickerDay(idx)}>
                  <Text style={s.btnOutlineText}>+</Text>
                </PressableScale>
              </View>
            </View>

            {dayExs.length === 0 ? (
              <Text style={s.restText}>{tr('gym.restDay')}</Text>
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

function ExercisePickerModal({ visible, day, routine, exercises, routineExercises, onClose, onAdded }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState('')
  const [newSubgroup, setNewSubgroup] = useState('')
  const [newUnilateral, setNewUnilateral] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [editingExId, setEditingExId] = useState(null)
  const [editExName, setEditExName] = useState('')
  const [editExMuscle, setEditExMuscle] = useState('')
  const [editExSubgroup, setEditExSubgroup] = useState('')
  const [editExUnilateral, setEditExUnilateral] = useState(false)

  const muscleGroups = [...new Set(exercises.map(e => e.muscle_group).filter(Boolean))].sort()
  const suggestions = muscleGroups.filter(g =>
    g.toLowerCase().includes(newMuscle.toLowerCase()) && g.toLowerCase() !== newMuscle.toLowerCase()
  )
  const subgroups = MUSCLE_SUBGROUPS[newMuscle] ?? []

  if (day === null) return null

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

  async function handleCreate() {
    if (!newName.trim()) return
    const id = await insertLocalExercise(newName.trim(), newMuscle.trim() || null, newSubgroup || null, newUnilateral)
    const pos = routineExercises.filter(re => re.day_of_week === day).length
    await insertRoutineExercise(routine.id, id, day, pos)
    setNewName('')
    setNewMuscle('')
    setNewSubgroup('')
    setNewUnilateral(false)
    onAdded()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{tr('gym.addTitle', { day: days[day] })}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={s.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 380 }}>
            {Object.keys(grouped).sort().map(group => (
              <View key={group} style={{ marginBottom: 14 }}>
                <Text style={s.groupLabel}>{group}</Text>
                {grouped[group].map(ex => {
                  if (editingExId === ex.id) {
                    return (
                      <View key={ex.id} style={{ paddingVertical: 5, flexDirection: 'row', gap: 6 }}>
                        <TextInput
                          autoFocus
                          style={[s.input, { flex: 1 }]}
                          value={editExName}
                          onChangeText={setEditExName}
                        />
                        <TouchableOpacity
                          style={s.btnPrimarySmall}
                          onPress={async () => {
                            if (!editExName.trim()) return
                            await updateLocalExercise(ex.id, editExName.trim(), editExMuscle || null, editExSubgroup || null, editExUnilateral)
                            setEditingExId(null)
                            onAdded()
                          }}
                        >
                          <Text style={s.btnPrimaryText}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.btnCancel} onPress={() => setEditingExId(null)}>
                          <Text style={s.btnCancelText}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setEditExUnilateral(v => !v)}
                          style={[s.uniToggle, editExUnilateral && s.uniToggleOn]}
                          hitSlop={6}
                        >
                          <Text style={[s.uniToggleText, editExUnilateral && s.uniToggleTextOn]}>{tr('gym.unilateralTag')}</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  }
                  return (
                    <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 }}>
                      <Text style={s.exerciseName}>{ex.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity onPress={() => { setEditingExId(ex.id); setEditExName(ex.name); setEditExMuscle(ex.muscle_group || ''); setEditExSubgroup(ex.muscle_subgroup || ''); setEditExUnilateral(!!ex.is_unilateral) }} hitSlop={8}>
                          <Ionicons name="pencil" size={14} color={t.text3} />
                        </TouchableOpacity>
                        {alreadyAdded.has(ex.id) ? (
                          <Text style={s.addedMark}>✓</Text>
                        ) : (
                          <TouchableOpacity style={s.btnPrimarySmall} onPress={() => handleAdd(ex)}>
                            <Text style={s.btnPrimaryText}>{tr('gym.addExercise')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>
            ))}

            {exercises.length === 0 && (
              <Text style={s.hint}>{tr('gym.noExercisesYet')}</Text>
            )}

            <View style={s.divider} />
            <Text style={[s.hint, { marginBottom: 6 }]}>{tr('gym.newExercise')}</Text>
            <TextInput
              style={s.input}
              placeholder={tr('gym.exerciseNamePh')}
              placeholderTextColor={t.text3}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[s.input, { marginTop: 6 }]}
              placeholder={tr('gym.musclePh')}
              placeholderTextColor={t.text3}
              value={newMuscle}
              onChangeText={v => { setNewMuscle(v); setNewSubgroup(''); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setShowSuggestions(false)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: t.border2, borderRadius: 6, marginTop: 2, overflow: 'hidden' }}>
                {suggestions.map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => { setNewMuscle(g); setNewSubgroup(''); setShowSuggestions(false) }}
                    style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}
                  >
                    <Text style={{ color: t.text2, fontSize: 13 }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {subgroups.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {subgroups.map(sg => (
                  <TouchableOpacity
                    key={sg}
                    onPress={() => setNewSubgroup(newSubgroup === sg ? '' : sg)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                      backgroundColor: newSubgroup === sg ? t.accent : t.border2,
                    }}
                  >
                    <Text style={{ color: newSubgroup === sg ? t.text : t.text3, fontSize: 12, fontWeight: '600' }}>{sg}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={s.uniRow}
              activeOpacity={0.7}
              onPress={() => setNewUnilateral(v => !v)}
            >
              <View style={[s.checkbox, newUnilateral && s.checkboxOn]}>
                {newUnilateral && <Text style={s.checkboxMark}>✓</Text>}
              </View>
              <Text style={s.uniLabel}>{tr('gym.unilateral')}</Text>
            </TouchableOpacity>
            <PressableScale style={[s.btnPrimary, { marginTop: 8 }]} onPress={handleCreate}>
              <Text style={s.btnPrimaryText}>{tr('gym.createAndAdd')}</Text>
            </PressableScale>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Train View ────────────────────────────────────────────────────────────────

function TrainView({ routine, day, dayExercises, onBack, onSynced }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const [date, setDate] = useState(new Date().toLocaleDateString('sv'))
  const [showDatePicker, setShowDatePicker] = useState(false)
  // Un ejercicio unilateral guarda peso/reps por lado; uno bilateral, un solo valor.
  const emptySet = (un) => un
    ? { reps_l: '', weight_l: '', reps_r: '', weight_r: '' }
    : { reps: '', weight: '' }
  const [sets, setSets] = useState(() => {
    const init = {}
    dayExercises.forEach(ex => {
      init[ex.local_exercise_id] = [emptySet(ex.is_unilateral), emptySet(ex.is_unilateral), emptySet(ex.is_unilateral)]
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
          const sd = exSets[i]
          if (ex.is_unilateral) {
            if (sd.weight_l && sd.reps_l) {
              await insertWorkoutSet(sessionId, ex.local_exercise_id, i + 1, parseFloat(sd.weight_l), parseInt(sd.reps_l), null, 'left')
            }
            if (sd.weight_r && sd.reps_r) {
              await insertWorkoutSet(sessionId, ex.local_exercise_id, i + 1, parseFloat(sd.weight_r), parseInt(sd.reps_r), null, 'right')
            }
          } else if (sd.weight && sd.reps) {
            await insertWorkoutSet(sessionId, ex.local_exercise_id, i + 1, parseFloat(sd.weight), parseInt(sd.reps), null, 'both')
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={s.backBtn}>{tr('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{days[day]}</Text>
        <Text style={s.subtitle}>{routine.name}</Text>
        <View style={{ height: 16 }} />

        <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }]}>
          <Text style={s.hint}>{tr('common.date')}</Text>
          <TouchableOpacity
            style={[s.input, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: t.text, fontSize: 14 }}>{date}</Text>
            <Text>📅</Text>
          </TouchableOpacity>
          <DatePicker
            visible={showDatePicker}
            value={date}
            onClose={() => setShowDatePicker(false)}
            onSelect={setDate}
          />
        </View>

        {dayExercises.map(ex => (
          <View key={ex.local_exercise_id} style={[s.card, { marginBottom: 12 }]}>
            <Text style={s.dayName}>
              {ex.muscle_group ? `[${ex.muscle_group}] ` : ''}{ex.exercise_name}
              {ex.is_unilateral ? <Text style={{ color: t.accent, fontSize: 11, fontWeight: '700' }}>{'  '}{tr('gym.unilateralTag')}</Text> : null}
            </Text>

            <View style={{ flexDirection: 'row', marginTop: 10, marginBottom: 4 }}>
              <View style={{ width: 60 }} />
              <Text style={[s.colHeader, { flex: 1 }]}>{tr('gym.reps')}</Text>
              <Text style={[s.colHeader, { flex: 1 }]}>{tr('gym.kg')}</Text>
            </View>

            {ex.is_unilateral
              ? (sets[ex.local_exercise_id] || []).map((setData, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={[s.restText, { fontSize: 12, marginBottom: 2 }]}>{tr('gym.serieLabel', { n: i + 1 })}</Text>
                  {[['reps_l', 'weight_l', tr('gym.sideLeft')], ['reps_r', 'weight_r', tr('gym.sideRight')]].map(([repsField, weightField, label]) => (
                    <View key={repsField} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={[s.restText, { width: 60, fontWeight: '600', color: t.text2 }]}>{label}</Text>
                      <TextInput
                        style={[s.input, { flex: 1, marginRight: 6 }]}
                        keyboardType="number-pad" placeholder="—" placeholderTextColor={t.text3}
                        value={setData[repsField]}
                        onChangeText={v => updateSet(ex.local_exercise_id, i, repsField, v)}
                      />
                      <TextInput
                        style={[s.input, { flex: 1 }]}
                        keyboardType="decimal-pad" placeholder="—" placeholderTextColor={t.text3}
                        value={setData[weightField]}
                        onChangeText={v => updateSet(ex.local_exercise_id, i, weightField, v)}
                      />
                    </View>
                  ))}
                </View>
              ))
              : (sets[ex.local_exercise_id] || []).map((setData, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[s.restText, { width: 60 }]}>{tr('gym.serieLabel', { n: i + 1 })}</Text>
                  <TextInput
                    style={[s.input, { flex: 1, marginRight: 6 }]}
                    keyboardType="number-pad" placeholder="—" placeholderTextColor={t.text3}
                    value={setData.reps}
                    onChangeText={v => updateSet(ex.local_exercise_id, i, 'reps', v)}
                  />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    keyboardType="decimal-pad" placeholder="—" placeholderTextColor={t.text3}
                    value={setData.weight}
                    onChangeText={v => updateSet(ex.local_exercise_id, i, 'weight', v)}
                  />
                </View>
              ))}
          </View>
        ))}

        {dayExercises.length === 0 && (
          <Text style={s.hint}>{tr('gym.noExercisesDay')}</Text>
        )}

        <TouchableOpacity
          style={[s.btnPrimary, { paddingVertical: 13, opacity: saving || dayExercises.length === 0 ? 0.5 : 1 }]}
          onPress={handleSave}
          disabled={saving || dayExercises.length === 0}
        >
          <Text style={[s.btnPrimaryText, { textAlign: 'center', fontSize: 15 }]}>
            {saving ? tr('gym.savingSession') : tr('gym.saveSession')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ visible, message, onConfirm, onCancel }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{tr('common.confirm')}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={10}>
              <Text style={s.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: t.text2, fontSize: 14, padding: 16, paddingTop: 8 }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingTop: 0, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={s.btnCancel} onPress={onCancel}>
              <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: t.dangerBg, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 }} onPress={onConfirm}>
              <Text style={{ color: t.dangerText, fontSize: 13, fontWeight: '600' }}>{tr('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (t) => StyleSheet.create({
  screen:          { flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 16 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tabBar:          { flexDirection: 'row', backgroundColor: t.surface, borderRadius: 8, padding: 3, marginBottom: 16, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor },
  tabBtn:          { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  tabBtnActive:    { backgroundColor: t.accent },
  tabBtnText:      { color: t.text3, fontSize: 13, fontWeight: '500' },
  tabBtnTextActive:{ color: t.text, fontWeight: '600' },
  title:           { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
  subtitle:        { color: t.text2, fontSize: 13, marginBottom: 20 },
  hint:            { color: t.text3, fontSize: 13 },
  backBtn:         { color: t.accent, fontSize: 14, marginBottom: 2 },
  card:            { backgroundColor: t.surface, borderRadius: 10, padding: 14, marginBottom: 6, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  rowCard:         { backgroundColor: t.surface, borderRadius: 10, padding: 14, marginBottom: 6, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...(t.cartoon ? t.shadow : {}) },
  rowText:         { color: t.text, fontSize: 14, fontWeight: '500' },
  deleteBtn:       { color: t.text3, fontSize: 20, lineHeight: 22 },
  deleteSmall:     { color: t.text3, fontSize: 18, lineHeight: 20, paddingHorizontal: 4 },
  dayName:         { color: t.text, fontSize: 14, fontWeight: '600' },
  restText:        { color: t.text3, fontSize: 12 },
  exerciseName:    { color: t.text2, fontSize: 13, flex: 1, marginRight: 8 },
  groupLabel:      { color: t.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  addedMark:       { color: t.text3, fontSize: 13 },
  colHeader:       { color: t.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  input:           { backgroundColor: t.inputBg, borderWidth: t.cartoon ? 2 : 1, borderColor: t.cartoon ? t.text : t.border2, borderRadius: 6, color: t.text, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  btnPrimary:      { backgroundColor: t.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  btnPrimarySmall: { backgroundColor: t.accent, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  btnPrimaryText:  { color: t.cartoon ? t.bg : t.text, fontSize: 13, fontWeight: '600', fontFamily: t.fontTitle },
  btnCancel:       { backgroundColor: t.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' },
  btnCancelText:   { color: t.text2, fontSize: 13 },
  uniRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  checkbox:        { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: t.border2, alignItems: 'center', justifyContent: 'center' },
  checkboxOn:      { backgroundColor: t.accent, borderColor: t.accent },
  checkboxMark:    { color: t.cartoon ? t.bg : t.text, fontSize: 12, fontWeight: '700' },
  uniLabel:        { color: t.text2, fontSize: 13 },
  uniToggle:       { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: t.border2, justifyContent: 'center' },
  uniToggleOn:     { backgroundColor: t.accent, borderColor: t.accent },
  uniToggleText:   { color: t.text3, fontSize: 10, fontWeight: '700' },
  uniToggleTextOn: { color: t.cartoon ? t.bg : t.text },
  btnOutline:      { borderWidth: 1, borderColor: t.border2, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  btnOutlineText:  { color: t.text2, fontSize: 16, lineHeight: 18 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:           { backgroundColor: t.surface, borderRadius: 12, padding: 16, width: '100%', maxWidth: 380, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle:      { color: t.text, fontSize: 15, fontWeight: '600', fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
  closeBtn:        { color: t.text2, fontSize: 22, lineHeight: 24 },
  divider:         { height: 1, backgroundColor: t.border, marginVertical: 12 },
})
