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

export async function fetchAllFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/body-weight/`)
  return res.json()
}

export async function postToServer(entry) {
  const res = await fetchWithTimeout(`${SERVER}/body-weight/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight: entry.weight, date: entry.date, note: entry.note || null }),
  })
  return res.json()
}

export async function deleteFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/body-weight/${serverId}`, { method: 'DELETE' })
}

// ── Exercises ──────────────────────────────────────────────────────────────────

export async function fetchAllExercisesFromServer() {
  const res = await fetchWithTimeout(`${SERVER}/exercises/`)
  return res.json()
}

export async function postExerciseToServer(ex) {
  const res = await fetchWithTimeout(`${SERVER}/exercises/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ex.name, muscle_group: ex.muscle_group || null, notes: ex.notes || null, position: ex.position ?? 0 }),
  })
  return res.json()
}

export async function putExerciseToServer(serverId, ex) {
  const res = await fetchWithTimeout(`${SERVER}/exercises/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ex.name, muscle_group: ex.muscle_group || null, notes: ex.notes || null }),
  })
  return res.json()
}

export async function deleteExerciseFromServer(serverId) {
  await fetchWithTimeout(`${SERVER}/exercises/${serverId}`, { method: 'DELETE' })
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
