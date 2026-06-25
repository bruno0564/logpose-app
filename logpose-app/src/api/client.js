const SERVER = 'http://localhost:8000'
const TIMEOUT_MS = 3000

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

// ── Countdowns ──────────────────────────────────────────────────────────────

function countdownPayload(entry) {
  return {
    title: entry.title,
    target_date: entry.target_date,
    is_recurring: !!entry.is_recurring,
  }
}

export async function fetchAllCountdownsFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/countdowns/`)
  return res.json()
}

export async function postCountdownToServer(entry) {
  const res = await fetchWithTimeout(`${SERVER}/countdowns/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(countdownPayload(entry)),
  })
  return res.json()
}

export async function putCountdownToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${SERVER}/countdowns/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(countdownPayload(entry)),
  })
  return res.json()
}

export async function deleteCountdownFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/countdowns/${serverId}`, { method: 'DELETE' })
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

export async function putRoutineExerciseToServer(serverId, re) {
  const res = await fetchWithTimeout(`${SERVER}/gym/routine-exercises/${serverId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day_of_week: re.day_of_week, position: re.position }),
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
  const res = await fetchWithTimeout(`${SERVER}/routines/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: routine.name }),
  })
  return res.json()
}

export async function putExerciseToServer(serverId, exercise) {
  const res = await fetchWithTimeout(`${SERVER}/exercises/${serverId}`, {
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
      side: set.side || 'both',
    }),
  })
  return res.json()
}

// ── Task Lists ────────────────────────────────────────────────────────────────

export async function fetchAllTaskListsFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/tasks/lists`)
  return res.json()
}

export async function postTaskListToServer(name) {
  const res = await fetchWithTimeout(`${SERVER}/tasks/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return res.json()
}

export async function deleteTaskListFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/tasks/lists/${serverId}`, { method: 'DELETE' })
}

// ── Task Items ────────────────────────────────────────────────────────────────

export async function fetchTaskItemsFromServer(serverListId) {
  const res = await fetchWithTimeout(`${SERVER}/tasks/lists/${serverListId}/items`)
  return res.json()
}

export async function postTaskItemToServer(serverListId, title, done = false) {
  const res = await fetchWithTimeout(`${SERVER}/tasks/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_id: serverListId, title, done }),
  })
  return res.json()
}

export async function putTaskItemToServer(serverId, title, done) {
  const res = await fetchWithTimeout(`${SERVER}/tasks/items/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, done }),
  })
  return res.json()
}

export async function deleteTaskItemFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/tasks/items/${serverId}`, { method: 'DELETE' })
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
      reminder_minutes: event.reminder_minutes ?? null,
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
      reminder_minutes: event.reminder_minutes ?? null,
    }),
  })
  return res.json()
}

export async function deleteCalendarEventFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/calendar/${serverId}`, { method: 'DELETE' })
}

// ── Journal ───────────────────────────────────────────────────────────────────

export async function fetchAllJournalEntriesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/journal/`)
  return res.json()
}

export async function postJournalEntryToServer(entry) {
  const res = await fetchWithTimeout(`${SERVER}/journal/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: entry.date, content: entry.content }),
  })
  return res.json()
}

export async function putJournalEntryToServer(serverId, entry) {
  const res = await fetchWithTimeout(`${SERVER}/journal/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: entry.content }),
  })
  return res.json()
}

export async function deleteJournalEntryFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/journal/${serverId}`, { method: 'DELETE' })
}

// ── Journal Images ───────────────────────────────────────────────────────────
// Las imágenes no usan fetchWithTimeout (3 s es poco para subir/bajar bytes);
// usan fetch directo con comprobación de res.ok.

const UPLOAD_TIMEOUT_MS = 30000

async function fetchImg(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
    return res
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchAllJournalImagesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/journal/images/`)
  return res.json()
}

// Sube los bytes (Uint8Array) como multipart. Devuelve el metadato creado (con id).
export async function uploadJournalImageToServer({ date, position = 0, caption = null, bytes, contentType, filename }) {
  const form = new FormData()
  form.append('date', date)
  form.append('position', String(position))
  if (caption != null) form.append('caption', caption)
  form.append('file', new Blob([bytes], { type: contentType }), filename || 'image')
  const res = await fetchImg(`${SERVER}/journal/images/`, { method: 'POST', body: form })
  return res.json()
}

// Descarga los bytes de una imagen del servidor (Uint8Array).
export async function downloadJournalImageBytes(serverId) {
  const res = await fetchImg(`${SERVER}/journal/images/${serverId}/file`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function deleteJournalImageFromServer(serverId) {
  await fetchImg(`${SERVER}/journal/images/${serverId}`, { method: 'DELETE' })
}

// ── Habits ────────────────────────────────────────────────────────────────────

export async function fetchAllHabitCategoriesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/habits/categories`)
  return res.json()
}
export async function postHabitCategoryToServer(cat) {
  const res = await fetchWithTimeout(`${SERVER}/habits/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cat.name, color: cat.color }),
  })
  return res.json()
}
export async function putHabitCategoryToServer(serverId, cat) {
  const res = await fetchWithTimeout(`${SERVER}/habits/categories/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cat.name, color: cat.color }),
  })
  return res.json()
}
export async function deleteHabitCategoryFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/habits/categories/${serverId}`, { method: 'DELETE' })
}

export async function fetchAllHabitsFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/habits/`)
  return res.json()
}
export async function postHabitToServer(habit, categoryServerId) {
  const res = await fetchWithTimeout(`${SERVER}/habits/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryServerId, name: habit.name, days_of_week: habit.days_of_week, position: habit.position, reminder_time: habit.reminder_time || null }),
  })
  return res.json()
}
export async function putHabitToServer(serverId, habit) {
  const res = await fetchWithTimeout(`${SERVER}/habits/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: habit.name, days_of_week: habit.days_of_week, position: habit.position, reminder_time: habit.reminder_time || null }),
  })
  return res.json()
}
export async function deleteHabitFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/habits/${serverId}`, { method: 'DELETE' })
}

export async function fetchHabitLogsFromServer(month) {
  const res = await fetchWithTimeout(`${SERVER}/habits/logs?month=${month}`)
  return res.json()
}
export async function postHabitLogToServer(log, habitServerId) {
  const res = await fetchWithTimeout(`${SERVER}/habits/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ habit_id: habitServerId, date: log.date }),
  })
  return res.json()
}
export async function deleteHabitLogFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/habits/logs/${serverId}`, { method: 'DELETE' })
}
