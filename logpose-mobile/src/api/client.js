import AsyncStorage from '@react-native-async-storage/async-storage'

const DEFAULT_SERVER = 'http://archlinux.local:8000'
const TIMEOUT_MS = 3000

let _server = DEFAULT_SERVER

export async function initServerUrl() {
  try {
    const saved = await AsyncStorage.getItem('serverUrl')
    if (saved && saved.trim()) _server = saved.trim()
  } catch {}
}

export function getServerUrl() {
  return _server
}

export async function updateServerUrl(raw) {
  let url = raw.trim().replace(/\/$/, '')
  if (url && !url.includes('://')) url = 'http://' + url
  _server = url || DEFAULT_SERVER
  await AsyncStorage.setItem('serverUrl', _server)
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
    return res
  } finally {
    clearTimeout(timer)
  }
}

export async function isServerReachable() {
  try {
    await fetchWithTimeout(`${_server}/`)
    return true
  } catch {
    return false
  }
}

// Prueba una URL arbitraria (sin guardarla). Normaliza igual que updateServerUrl.
export async function pingServer(raw) {
  let url = (raw || '').trim().replace(/\/$/, '')
  if (!url) return false
  if (!url.includes('://')) url = 'http://' + url
  try {
    await fetchWithTimeout(`${url}/`)
    return true
  } catch {
    return false
  }
}

export async function fetchAllBodyWeightFromServer() {
  const res = await fetchWithTimeout(`${_server}/body-weight/`)
  return res.json()
}

export async function postBodyWeightToServer(entry) {
  const res = await fetchWithTimeout(`${_server}/body-weight/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: entry.weight, date: entry.date, note: entry.note || null }),
  })
  return res.json()
}

export async function putBodyWeightToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${_server}/body-weight/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: entry.weight, date: entry.date, note: entry.note || null }),
  })
  return res.json()
}

export async function deleteBodyWeightFromServer(serverId) {
  await fetchWithTimeout(`${_server}/body-weight/${serverId}`, { method: 'DELETE' })
}

// ── Quotes ────────────────────────────────────────────────────────────────

export async function fetchAllQuotesFromServer() {
  const res = await fetchWithTimeout(`${_server}/quotes/`)
  return res.json()
}

export async function postQuoteToServer(entry) {
  const res = await fetchWithTimeout(`${_server}/quotes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: entry.text, author: entry.author || null }),
  })
  return res.json()
}

export async function deleteQuoteFromServer(serverId) {
  await fetchWithTimeout(`${_server}/quotes/${serverId}`, { method: 'DELETE' })
}

// ── Countdowns ──────────────────────────────────────────────────────────────

function countdownPayload(entry) {
  return {
    title: entry.title,
    target_date: entry.target_date,
    is_recurring: !!entry.is_recurring,
  }
}

export async function fetchAllCountdownsFromServer() {
  const res = await fetchWithTimeout(`${_server}/countdowns/`)
  return res.json()
}

export async function postCountdownToServer(entry) {
  const res = await fetchWithTimeout(`${_server}/countdowns/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(countdownPayload(entry)),
  })
  return res.json()
}

export async function putCountdownToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${_server}/countdowns/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(countdownPayload(entry)),
  })
  return res.json()
}

export async function deleteCountdownFromServer(serverId) {
  await fetchWithTimeout(`${_server}/countdowns/${serverId}`, { method: 'DELETE' })
}

// ── Routines ──────────────────────────────────────────────────────────────────

export async function fetchAllRoutinesFromServer() {
  const res = await fetchWithTimeout(`${_server}/routines/`)
  return res.json()
}

export async function postRoutineToServer(routine) {
  const res = await fetchWithTimeout(`${_server}/routines/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: routine.name }),
  })
  return res.json()
}

export async function deleteRoutineFromServer(serverId) {
  await fetchWithTimeout(`${_server}/routines/${serverId}`, { method: 'DELETE' })
}

// ── Routine Exercises ─────────────────────────────────────────────────────────

export async function fetchAllRoutineExercisesFromServer() {
  const res = await fetchWithTimeout(`${_server}/gym/routine-exercises/`)
  return res.json()
}

export async function postRoutineExerciseToServer(re) {
  const res = await fetchWithTimeout(`${_server}/gym/routine-exercises/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routine_id: re.server_routine_id,
      exercise_id: re.server_exercise_id,
      day_of_week: re.day_of_week,
      position: re.position,
      target_sets: re.target_sets ?? 3,
    }),
  })
  return res.json()
}

export async function putRoutineExerciseToServer(serverId, re) {
  const res = await fetchWithTimeout(`${_server}/gym/routine-exercises/${serverId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day_of_week: re.day_of_week, position: re.position, target_sets: re.target_sets ?? 3 }),
  })
  return res.json()
}

export async function deleteRoutineExerciseFromServer(serverId) {
  await fetchWithTimeout(`${_server}/gym/routine-exercises/${serverId}`, { method: 'DELETE' })
}

// ── Exercises ─────────────────────────────────────────────────────────────────

export async function fetchAllExercisesFromServer() {
  const res = await fetchWithTimeout(`${_server}/exercises/`)
  return res.json()
}

export async function postExerciseToServer(exercise) {
  const res = await fetchWithTimeout(`${_server}/exercises/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: exercise.name,
      muscle_group: exercise.muscle_group || null,
      muscle_subgroup: exercise.muscle_subgroup || null,
      is_unilateral: !!exercise.is_unilateral,
    }),
  })
  return res.json()
}

export async function putRoutineToServer(serverId, routine) {
  const res = await fetchWithTimeout(`${_server}/routines/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: routine.name }),
  })
  return res.json()
}

export async function putExerciseToServer(serverId, exercise) {
  const res = await fetchWithTimeout(`${_server}/exercises/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: exercise.name,
      muscle_group: exercise.muscle_group || null,
      muscle_subgroup: exercise.muscle_subgroup || null,
      is_unilateral: !!exercise.is_unilateral,
    }),
  })
  return res.json()
}

export async function deleteExerciseFromServer(serverId) {
  await fetchWithTimeout(`${_server}/exercises/${serverId}`, { method: 'DELETE' })
}

// ── Gym (sessions + sets) ────────────────────────────────────────────────────

export async function fetchAllSessionsFromServer() {
  const res = await fetchWithTimeout(`${_server}/gym/sessions/`)
  return res.json()
}

export async function fetchAllSetsFromServer() {
  const res = await fetchWithTimeout(`${_server}/gym/sets/`)
  return res.json()
}

export async function deleteSessionFromServer(serverId) {
  await fetchWithTimeout(`${_server}/gym/sessions/${serverId}`, { method: 'DELETE' })
}

export async function deleteSetFromServer(serverId) {
  await fetchWithTimeout(`${_server}/gym/sets/${serverId}`, { method: 'DELETE' })
}

export async function postSessionToServer(session) {
  const res = await fetchWithTimeout(`${_server}/gym/sessions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routine_id: session.server_routine_id || null,
      day_of_week: session.day_of_week ?? null,
      date: session.date,
      note: session.note || null,
    }),
  })
  return res.json()
}

export async function postSetToServer(set) {
  const res = await fetchWithTimeout(`${_server}/gym/sets/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: set.server_session_id,
      exercise_id: set.server_exercise_id,
      set_number: set.set_number,
      weight: set.weight,
      reps: set.reps,
      note: set.note || null,
      side: set.side || 'both',
    }),
  })
  return res.json()
}

// ── Quotes (update) ───────────────────────────────────────────────────────────

export async function putQuoteToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${_server}/quotes/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: entry.text, author: entry.author || null }),
  })
  return res.json()
}

// ── Task Lists ────────────────────────────────────────────────────────────────

export async function fetchAllTaskListsFromServer() {
  const res = await fetchWithTimeout(`${_server}/tasks/lists`)
  return res.json()
}

export async function postTaskListToServer(name) {
  const res = await fetchWithTimeout(`${_server}/tasks/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return res.json()
}

export async function deleteTaskListFromServer(serverId) {
  await fetchWithTimeout(`${_server}/tasks/lists/${serverId}`, { method: 'DELETE' })
}

// ── Task Items ────────────────────────────────────────────────────────────────

export async function fetchTaskItemsFromServer(serverListId) {
  const res = await fetchWithTimeout(`${_server}/tasks/lists/${serverListId}/items`)
  return res.json()
}

export async function postTaskItemToServer(serverListId, title, done = false) {
  const res = await fetchWithTimeout(`${_server}/tasks/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_id: serverListId, title, done }),
  })
  return res.json()
}

export async function putTaskItemToServer(serverId, title, done) {
  const res = await fetchWithTimeout(`${_server}/tasks/items/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, done }),
  })
  return res.json()
}

export async function deleteTaskItemFromServer(serverId) {
  await fetchWithTimeout(`${_server}/tasks/items/${serverId}`, { method: 'DELETE' })
}

// ── Calendar Events ────────────────────────────────────────────────────────────

export async function fetchAllCalendarEventsFromServer() {
  const res = await fetchWithTimeout(`${_server}/calendar/`)
  return res.json()
}

export async function postCalendarEventToServer(event) {
  const res = await fetchWithTimeout(`${_server}/calendar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: event.title, date: event.date || null,
      start_time: event.start_time || null, end_time: event.end_time || null,
      recurrence: event.recurrence, days_of_week: event.days_of_week || null,
      notes: event.notes || null, color: event.color || null,
    }),
  })
  return res.json()
}

export async function putCalendarEventToServer(serverId, event) {
  const res = await fetchWithTimeout(`${_server}/calendar/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: event.title, date: event.date || null,
      start_time: event.start_time || null, end_time: event.end_time || null,
      recurrence: event.recurrence, days_of_week: event.days_of_week || null,
      notes: event.notes || null, color: event.color || null,
    }),
  })
  return res.json()
}

export async function deleteCalendarEventFromServer(serverId) {
  await fetchWithTimeout(`${_server}/calendar/${serverId}`, { method: 'DELETE' })
}

// ── Journal ───────────────────────────────────────────────────────────────────

export async function fetchAllJournalEntriesFromServer() {
  const res = await fetchWithTimeout(`${_server}/journal/`)
  return res.json()
}

export async function postJournalEntryToServer(entry) {
  const res = await fetchWithTimeout(`${_server}/journal/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: entry.date, content: entry.content }),
  })
  return res.json()
}

export async function putJournalEntryToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${_server}/journal/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: entry.content }),
  })
  return res.json()
}

export async function deleteJournalEntryFromServer(serverId) {
  await fetchWithTimeout(`${_server}/journal/${serverId}`, { method: 'DELETE' })
}

// ── Journal Images ───────────────────────────────────────────────────────────
// Subir/borrar usan un timeout más amplio (los bytes tardan más que 3 s).

const IMG_TIMEOUT_MS = 30000

async function fetchImg(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMG_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
    return res
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchAllJournalImagesFromServer() {
  const res = await fetchWithTimeout(`${_server}/journal/images/`)
  return res.json()
}

// URL pública del fichero (para descargarlo con expo-file-system).
export function journalImageFileUrl(serverId) {
  return `${_server}/journal/images/${serverId}/file`
}

// Sube el fichero local como multipart. Devuelve el metadato creado (con id).
export async function uploadJournalImageToServer({ date, position = 0, caption = null, uri, contentType, filename }) {
  const form = new FormData()
  form.append('date', date)
  form.append('position', String(position))
  if (caption != null) form.append('caption', caption)
  // En RN, FormData acepta un objeto fichero { uri, name, type }.
  form.append('file', { uri, name: filename || 'image.jpg', type: contentType })
  const res = await fetchImg(`${_server}/journal/images/`, { method: 'POST', body: form })
  return res.json()
}

export async function deleteJournalImageFromServer(serverId) {
  await fetchImg(`${_server}/journal/images/${serverId}`, { method: 'DELETE' })
}

// ── Habits ────────────────────────────────────────────────────────────────────

export async function fetchAllHabitCategoriesFromServer() {
  const res = await fetchWithTimeout(`${_server}/habits/categories`)
  return res.json()
}
export async function postHabitCategoryToServer(cat) {
  const res = await fetchWithTimeout(`${_server}/habits/categories`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cat.name, color: cat.color }),
  })
  return res.json()
}
export async function putHabitCategoryToServer(serverId, cat) {
  const res = await fetchWithTimeout(`${_server}/habits/categories/${serverId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cat.name, color: cat.color }),
  })
  return res.json()
}
export async function deleteHabitCategoryFromServer(serverId) {
  await fetchWithTimeout(`${_server}/habits/categories/${serverId}`, { method: 'DELETE' })
}

export async function fetchAllHabitsFromServer() {
  const res = await fetchWithTimeout(`${_server}/habits/`)
  return res.json()
}
export async function postHabitToServer(habit, categoryServerId) {
  const res = await fetchWithTimeout(`${_server}/habits/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryServerId, name: habit.name, days_of_week: habit.days_of_week, position: habit.position }),
  })
  return res.json()
}
export async function putHabitToServer(serverId, habit) {
  const res = await fetchWithTimeout(`${_server}/habits/${serverId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: habit.name, days_of_week: habit.days_of_week, position: habit.position }),
  })
  return res.json()
}
export async function deleteHabitFromServer(serverId) {
  await fetchWithTimeout(`${_server}/habits/${serverId}`, { method: 'DELETE' })
}

export async function fetchHabitLogsFromServer(month) {
  const res = await fetchWithTimeout(`${_server}/habits/logs?month=${month}`)
  return res.json()
}
export async function postHabitLogToServer(log, habitServerId) {
  const res = await fetchWithTimeout(`${_server}/habits/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habit_id: habitServerId, date: log.date }),
  })
  return res.json()
}
export async function deleteHabitLogFromServer(serverId) {
  await fetchWithTimeout(`${_server}/habits/logs/${serverId}`, { method: 'DELETE' })
}
