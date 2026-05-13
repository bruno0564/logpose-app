const SERVER = 'http://archlinux.local:8000'
const TIMEOUT_MS = 3000

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
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
