const SERVER = 'http://localhost:8000'
const TIMEOUT_MS = 3000

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function isServerReachable() {
  try {
    await fetchWithTimeout(`${SERVER}/`)
    return true
  } catch {
    return false
  }
}

// ── Body Weight ────────────────────────────────────────────────────────────────

export async function fetchAllBodyWeightFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/body-weight/`)
  return res.json()
}

export async function postBodyWeightToServer(entry) {
  const res = await fetchWithTimeout(`${SERVER}/body-weight/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: entry.weight, date: entry.date, note: entry.note || null }),
  })
  return res.json()
}

export async function putBodyWeightToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${SERVER}/body-weight/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: entry.weight, date: entry.date, note: entry.note || null }),
  })
  return res.json()
}

export async function deleteBodyWeightFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/body-weight/${serverId}`, { method: 'DELETE' })
}

// ── Quotes ────────────────────────────────────────────────────────────────

export async function fetchAllQuotesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/quotes/`)
  return res.json()
}

export async function postQuoteToServer(entry) {
  const res = await fetchWithTimeout(`${SERVER}/quotes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: entry.text, author: entry.author || null }),
  })
  return res.json()
}

export async function putQuoteToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${SERVER}/quotes/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: entry.text, author: entry.author || null }),
  })
  return res.json()
}

export async function deleteQuoteFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/quotes/${serverId}`, { method: 'DELETE' })
}

// ── Routines ──────────────────────────────────────────────────────────────────

export async function fetchAllRoutinesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/routines/`)
  return res.json()
}

export async function postRoutineToServer(routine) {
  const res = await fetchWithTimeout(`${SERVER}/routines/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: routine.name }),
  })
  return res.json()
}

export async function deleteRoutineFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/routines/${serverId}`, { method: 'DELETE' })
}

// ── Routine Exercises ─────────────────────────────────────────────────────────

export async function fetchAllRoutineExercisesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/gym/routine-exercises/`)
  return res.json()
}

export async function postRoutineExerciseToServer(re) {
  const res = await fetchWithTimeout(`${SERVER}/gym/routine-exercises/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routine_id: re.server_routine_id,
      exercise_id: re.server_exercise_id,
      day_of_week: re.day_of_week,
      position: re.position,
    }),
  })
  return res.json()
}

export async function deleteRoutineExerciseFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/gym/routine-exercises/${serverId}`, { method: 'DELETE' })
}

// ── Exercises ─────────────────────────────────────────────────────────────────

export async function fetchAllExercisesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/exercises/`)
  return res.json()
}

export async function postExerciseToServer(exercise) {
  const res = await fetchWithTimeout(`${SERVER}/exercises/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: exercise.name, muscle_group: exercise.muscle_group || null }),
  })
  return res.json()
}

export async function deleteExerciseFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/exercises/${serverId}`, { method: 'DELETE' })
}

// ── Gym (sessions + sets) ────────────────────────────────────────────────────

export async function fetchAllSessionsFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/gym/sessions/`)
  return res.json()
}

export async function fetchAllSetsFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/gym/sets/`)
  return res.json()
}

export async function deleteSessionFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/gym/sessions/${serverId}`, { method: 'DELETE' })
}

export async function deleteSetFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/gym/sets/${serverId}`, { method: 'DELETE' })
}

export async function postSessionToServer(session) {
  const res = await fetchWithTimeout(`${SERVER}/gym/sessions/`, {
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
  const res = await fetchWithTimeout(`${SERVER}/gym/sets/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: set.server_session_id,
      exercise_id: set.server_exercise_id,
      set_number: set.set_number,
      weight: set.weight,
      reps: set.reps,
      note: set.note || null,
    }),
  })
  return res.json()
}

// ── To-Do Lists ────────────────────────────────────────────────────────────────

export async function fetchAllTodoListsFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/todos/lists`)
  return res.json()
}

export async function postTodoListToServer(name) {
  const res = await fetchWithTimeout(`${SERVER}/todos/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return res.json()
}

export async function deleteTodoListFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/todos/lists/${serverId}`, { method: 'DELETE' })
}

// ── To-Do Items ────────────────────────────────────────────────────────────────

export async function fetchTodoItemsFromServer(serverListId) {
  const res = await fetchWithTimeout(`${SERVER}/todos/lists/${serverListId}/items`)
  return res.json()
}

export async function postTodoItemToServer(serverListId, title, done = false) {
  const res = await fetchWithTimeout(`${SERVER}/todos/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_id: serverListId, title, done }),
  })
  return res.json()
}

export async function putTodoItemToServer(serverId, title, done) {
  const res = await fetchWithTimeout(`${SERVER}/todos/items/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, done }),
  })
  return res.json()
}

export async function deleteTodoItemFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/todos/items/${serverId}`, { method: 'DELETE' })
}

// ── Calendar Events ────────────────────────────────────────────────────────────

export async function fetchAllCalendarEventsFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/calendar/`)
  return res.json()
}

export async function postCalendarEventToServer(event) {
  const res = await fetchWithTimeout(`${SERVER}/calendar/`, {
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
  const res = await fetchWithTimeout(`${SERVER}/calendar/${serverId}`, {
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
  await fetchWithTimeout(`${SERVER}/calendar/${serverId}`, { method: 'DELETE' })
}
