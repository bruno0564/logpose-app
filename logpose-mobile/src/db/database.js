import * as SQLite from 'expo-sqlite'

let db

const REMOVED_QUOTES = [
  'El progreso, no la perfección.',
  'Un día a la vez.',
  'Cada registro cuenta.',
  'Lo que se mide, mejora.',
  'Constancia sobre intensidad.',
  'As long as I live, there are infinite chances.',
]

export async function openDB() {
  if (db) return db
  db = await SQLite.openDatabaseAsync('logpose.db')
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS body_weight (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id   INTEGER,
      weight      REAL    NOT NULL,
      date        TEXT    NOT NULL,
      note        TEXT,
      synced      INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quotes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      text           TEXT    NOT NULL,
      author         TEXT,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
  `)
  // migración: añadir columnas nuevas a quotes si no existen
  for (const col of [
    'ALTER TABLE quotes ADD COLUMN server_id INTEGER',
    'ALTER TABLE quotes ADD COLUMN author TEXT',
    'ALTER TABLE quotes ADD COLUMN synced INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE quotes ADD COLUMN pending_delete INTEGER NOT NULL DEFAULT 0',
  ]) {
    try { await db.runAsync(col) } catch {}
  }

  for (const text of REMOVED_QUOTES) {
    await db.runAsync('DELETE FROM quotes WHERE text = ?', [text])
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS routines (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      name           TEXT    NOT NULL,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      name           TEXT    NOT NULL,
      muscle_group   TEXT,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS routine_exercises (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id         INTEGER,
      local_routine_id  INTEGER NOT NULL REFERENCES routines(id),
      local_exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      day_of_week       INTEGER NOT NULL,
      position          INTEGER NOT NULL DEFAULT 0,
      synced            INTEGER NOT NULL DEFAULT 0,
      pending_delete    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id        INTEGER,
      local_routine_id INTEGER REFERENCES routines(id),
      day_of_week      INTEGER,
      date             TEXT    NOT NULL,
      note             TEXT,
      synced           INTEGER NOT NULL DEFAULT 0,
      pending_delete   INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workout_sets (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id         INTEGER,
      local_session_id  INTEGER NOT NULL REFERENCES workout_sessions(id),
      local_exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      set_number        INTEGER NOT NULL,
      weight            REAL    NOT NULL,
      reps              INTEGER NOT NULL,
      note              TEXT,
      synced            INTEGER NOT NULL DEFAULT 0,
      pending_delete    INTEGER NOT NULL DEFAULT 0
    );
  `)

  try { await db.runAsync('ALTER TABLE routines ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0') } catch {}

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS todo_lists (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      name           TEXT    NOT NULL,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS todo_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      local_list_id  INTEGER NOT NULL REFERENCES todo_lists(id),
      title          TEXT    NOT NULL,
      done           INTEGER NOT NULL DEFAULT 0,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      title          TEXT    NOT NULL,
      date           TEXT,
      start_time     TEXT,
      end_time       TEXT,
      recurrence     TEXT    NOT NULL DEFAULT 'none',
      days_of_week   TEXT,
      notes          TEXT,
      color          TEXT,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
  `)

  return db
}

export async function getQuotes() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM quotes WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertLocalQuote(text, author) {
  const db = await openDB()
  await db.runAsync(
    'INSERT INTO quotes (text, author, synced) VALUES (?, ?, 0)',
    [text.trim(), author || null]
  )
}

export async function deleteLocalQuote(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM quotes WHERE id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE quotes SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.runAsync('DELETE FROM quotes WHERE id = ?', [id])
  }
}

export async function getUnsyncedQuotes() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM quotes WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteQuotes() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM quotes WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markQuoteSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE quotes SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function upsertQuoteFromServer(serverQuote) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM quotes WHERE server_id = ?', [serverQuote.id])
  if (existing) {
    await db.runAsync(
      'UPDATE quotes SET text = ?, author = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverQuote.text, serverQuote.author, serverQuote.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO quotes (server_id, text, author, synced) VALUES (?, ?, ?, 1)',
      [serverQuote.id, serverQuote.text, serverQuote.author]
    )
  }
}

export async function getLatestWeight() {
  const db = await openDB()
  return db.getFirstAsync(
    'SELECT * FROM body_weight WHERE pending_delete = 0 ORDER BY date DESC LIMIT 1'
  )
}

export async function getLocalEntries() {
  const db = await openDB()
  return db.getAllAsync(
    'SELECT * FROM body_weight WHERE pending_delete = 0 ORDER BY date DESC'
  )
}

export async function insertLocalEntry(weight, date, note) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO body_weight (weight, date, note, synced) VALUES (?, ?, ?, 0)',
    [weight, date, note || null]
  )
  return result.lastInsertRowId
}

export async function updateLocalEntry(id, weight, date, note) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE body_weight SET weight = ?, date = ?, note = ?, synced = 0 WHERE id = ?',
    [weight, date, note || null, id]
  )
}

export async function markSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE body_weight SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function markPendingDelete(localId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE body_weight SET pending_delete = 1 WHERE id = ?',
    [localId]
  )
}

export async function deleteLocalEntry(localId) {
  const db = await openDB()
  await db.runAsync('DELETE FROM body_weight WHERE id = ?', [localId])
}

export async function upsertFromServer(serverEntry) {
  const db = await openDB()
  const existing = await db.getFirstAsync(
    'SELECT id FROM body_weight WHERE server_id = ?',
    [serverEntry.id]
  )
  if (existing) {
    await db.runAsync(
      'UPDATE body_weight SET weight = ?, date = ?, note = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverEntry.weight, serverEntry.date, serverEntry.note, serverEntry.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO body_weight (server_id, weight, date, note, synced) VALUES (?, ?, ?, ?, 1)',
      [serverEntry.id, serverEntry.weight, serverEntry.date, serverEntry.note]
    )
  }
}

export async function getUnsyncedEntries() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM body_weight WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeletes() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM body_weight WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function pruneEntriesDeletedFromServer(serverIds) {
  const db = await openDB()
  const local = await db.getAllAsync(
    'SELECT id, server_id FROM body_weight WHERE server_id IS NOT NULL AND pending_delete = 0'
  )
  for (const row of local) {
    if (!serverIds.has(row.server_id)) {
      await db.runAsync('DELETE FROM body_weight WHERE id = ?', [row.id])
    }
  }
}

// ── Routines ──────────────────────────────────────────────────────────────────

export async function getRoutines() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM routines WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertLocalRoutine(name) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO routines (name, synced) VALUES (?, 0)',
    [name.trim()]
  )
  return result.lastInsertRowId
}

export async function deleteLocalRoutine(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM routines WHERE id = ?', [id])
  await db.runAsync('DELETE FROM routine_exercises WHERE local_routine_id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE routines SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.runAsync('DELETE FROM routines WHERE id = ?', [id])
  }
}

export async function getUnsyncedRoutines() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM routines WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteRoutines() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM routines WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markRoutineSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE routines SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function upsertRoutineFromServer(serverRoutine) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM routines WHERE server_id = ?', [serverRoutine.id])
  if (existing) {
    await db.runAsync(
      'UPDATE routines SET name = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverRoutine.name, serverRoutine.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO routines (server_id, name, synced) VALUES (?, ?, 1)',
      [serverRoutine.id, serverRoutine.name]
    )
  }
}

// ── Exercises ─────────────────────────────────────────────────────────────────

export async function getExercises() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM exercises WHERE pending_delete = 0 ORDER BY muscle_group, name')
}

export async function insertLocalExercise(name, muscleGroup) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO exercises (name, muscle_group, synced) VALUES (?, ?, 0)',
    [name.trim(), muscleGroup || null]
  )
  return result.lastInsertRowId
}

export async function deleteLocalExercise(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM exercises WHERE id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE exercises SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.runAsync('DELETE FROM exercises WHERE id = ?', [id])
  }
}

export async function getUnsyncedExercises() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM exercises WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteExercises() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM exercises WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markExerciseSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE exercises SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function upsertExerciseFromServer(serverEx) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM exercises WHERE server_id = ?', [serverEx.id])
  if (existing) {
    await db.runAsync(
      'UPDATE exercises SET name = ?, muscle_group = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverEx.name, serverEx.muscle_group, serverEx.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO exercises (server_id, name, muscle_group, synced) VALUES (?, ?, ?, 1)',
      [serverEx.id, serverEx.name, serverEx.muscle_group]
    )
  }
}

// ── Routine Exercises ─────────────────────────────────────────────────────────

export async function getAllRoutineExercises(localRoutineId) {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT re.id, re.local_exercise_id, re.day_of_week, re.position,
           e.name as exercise_name, e.muscle_group
    FROM routine_exercises re
    JOIN exercises e ON e.id = re.local_exercise_id
    WHERE re.local_routine_id = ? AND re.pending_delete = 0
    ORDER BY re.day_of_week, re.position
  `, [localRoutineId])
}

export async function insertRoutineExercise(localRoutineId, localExerciseId, dayOfWeek, position) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO routine_exercises (local_routine_id, local_exercise_id, day_of_week, position, synced) VALUES (?, ?, ?, ?, 0)',
    [localRoutineId, localExerciseId, dayOfWeek, position]
  )
  return result.lastInsertRowId
}

export async function deleteRoutineExercise(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', [id])
}

// ── Workout Sessions ──────────────────────────────────────────────────────────

export async function insertWorkoutSession(localRoutineId, dayOfWeek, date, note) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO workout_sessions (local_routine_id, day_of_week, date, note, synced) VALUES (?, ?, ?, ?, 0)',
    [localRoutineId || null, dayOfWeek ?? null, date, note || null]
  )
  return result.lastInsertRowId
}

// ── Workout Sets ──────────────────────────────────────────────────────────────

export async function insertWorkoutSet(localSessionId, localExerciseId, setNumber, weight, reps, note) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO workout_sets (local_session_id, local_exercise_id, set_number, weight, reps, note, synced) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [localSessionId, localExerciseId, setNumber, weight, reps, note || null]
  )
  return result.lastInsertRowId
}

// ── Purge helpers (hard DELETE — used inside sync loops) ──────────────────────

export async function purgeLocalQuote(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM quotes WHERE id = ?', [id])
}

export async function purgeLocalRoutine(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM routine_exercises WHERE local_routine_id = ?', [id])
  await db.runAsync('DELETE FROM routines WHERE id = ?', [id])
}

export async function updateLocalQuote(id, text, author) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE quotes SET text = ?, author = ?, synced = 0 WHERE id = ?',
    [text.trim(), author || null, id]
  )
}

// ── Active Routine ────────────────────────────────────────────────────────────

export async function getActiveRoutine() {
  const db = await openDB()
  return db.getFirstAsync('SELECT * FROM routines WHERE is_active = 1 LIMIT 1')
}

export async function setActiveRoutine(localId) {
  const db = await openDB()
  await db.runAsync('UPDATE routines SET is_active = 0')
  await db.runAsync('UPDATE routines SET is_active = 1 WHERE id = ?', [localId])
}

export async function getActiveTrainingDays() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT DISTINCT re.day_of_week
    FROM routine_exercises re
    JOIN routines r ON r.id = re.local_routine_id
    WHERE r.is_active = 1 AND re.pending_delete = 0
  `)
}

// ── To-Do Lists ───────────────────────────────────────────────────────────────

export async function getTodoLists() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM todo_lists WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertTodoList(name) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO todo_lists (name, synced) VALUES (?, 0)',
    [name.trim()]
  )
  return result.lastInsertRowId
}

export async function deleteTodoList(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM todo_lists WHERE id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE todo_lists SET pending_delete = 1 WHERE id = ?', [id])
    await db.runAsync('UPDATE todo_items SET pending_delete = 1 WHERE local_list_id = ? AND server_id IS NOT NULL', [id])
    await db.runAsync('DELETE FROM todo_items WHERE local_list_id = ? AND server_id IS NULL', [id])
  } else {
    await db.runAsync('DELETE FROM todo_items WHERE local_list_id = ?', [id])
    await db.runAsync('DELETE FROM todo_lists WHERE id = ?', [id])
  }
}

export async function deleteLocalTodoList(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM todo_items WHERE local_list_id = ?', [id])
  await db.runAsync('DELETE FROM todo_lists WHERE id = ?', [id])
}

export async function getUnsyncedTodoLists() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM todo_lists WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteTodoLists() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM todo_lists WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markTodoListSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE todo_lists SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function upsertTodoListFromServer(serverList) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM todo_lists WHERE server_id = ?', [serverList.id])
  if (existing) {
    await db.runAsync(
      'UPDATE todo_lists SET name = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverList.name, serverList.id]
    )
    return existing.id
  } else {
    const result = await db.runAsync(
      'INSERT INTO todo_lists (server_id, name, synced) VALUES (?, ?, 1)',
      [serverList.id, serverList.name]
    )
    return result.lastInsertRowId
  }
}

// ── To-Do Items ───────────────────────────────────────────────────────────────

export async function getTodoItems(localListId) {
  const db = await openDB()
  return db.getAllAsync(
    'SELECT * FROM todo_items WHERE local_list_id = ? AND pending_delete = 0 ORDER BY id ASC',
    [localListId]
  )
}

export async function insertTodoItem(localListId, title) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO todo_items (local_list_id, title, done, synced) VALUES (?, ?, 0, 0)',
    [localListId, title.trim()]
  )
  return result.lastInsertRowId
}

export async function toggleTodoItem(id, done) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE todo_items SET done = ?, synced = 0 WHERE id = ?',
    [done ? 1 : 0, id]
  )
}

export async function deleteTodoItem(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM todo_items WHERE id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE todo_items SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.runAsync('DELETE FROM todo_items WHERE id = ?', [id])
  }
}

export async function deleteLocalTodoItem(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM todo_items WHERE id = ?', [id])
}

export async function getUnsyncedTodoItems() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT i.*, l.server_id as list_server_id
    FROM todo_items i
    JOIN todo_lists l ON l.id = i.local_list_id
    WHERE i.synced = 0 AND i.pending_delete = 0 AND l.server_id IS NOT NULL
  `)
}

export async function getPendingDeleteTodoItems() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM todo_items WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markTodoItemSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE todo_items SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function upsertTodoItemFromServer(serverItem, localListId) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM todo_items WHERE server_id = ?', [serverItem.id])
  if (existing) {
    await db.runAsync(
      'UPDATE todo_items SET title = ?, done = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverItem.title, serverItem.done ? 1 : 0, serverItem.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO todo_items (server_id, local_list_id, title, done, synced) VALUES (?, ?, ?, ?, 1)',
      [serverItem.id, localListId, serverItem.title, serverItem.done ? 1 : 0]
    )
  }
}

// ── Calendar Events ───────────────────────────────────────────────────────────

export async function getCalendarEvents() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM calendar_events WHERE pending_delete = 0')
}

export async function insertCalendarEvent(ev) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO calendar_events (title, date, start_time, end_time, recurrence, days_of_week, notes, color, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [ev.title, ev.date || null, ev.start_time || null, ev.end_time || null, ev.recurrence || 'none', ev.days_of_week || null, ev.notes || null, ev.color || null]
  )
  return result.lastInsertRowId
}

export async function updateCalendarEvent(id, ev) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE calendar_events SET title = ?, date = ?, start_time = ?, end_time = ?, recurrence = ?, days_of_week = ?, notes = ?, color = ?, synced = 0 WHERE id = ?',
    [ev.title, ev.date || null, ev.start_time || null, ev.end_time || null, ev.recurrence || 'none', ev.days_of_week || null, ev.notes || null, ev.color || null, id]
  )
}

export async function markCalendarEventPendingDelete(id) {
  const db = await openDB()
  await db.runAsync('UPDATE calendar_events SET pending_delete = 1 WHERE id = ?', [id])
}

export async function purgeCalendarEvent(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM calendar_events WHERE id = ?', [id])
}

export async function markCalendarEventSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE calendar_events SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function getUnsyncedCalendarEvents() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM calendar_events WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteCalendarEvents() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM calendar_events WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function upsertCalendarEventFromServer(serverEv) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM calendar_events WHERE server_id = ?', [serverEv.id])
  if (existing) {
    await db.runAsync(
      'UPDATE calendar_events SET title = ?, date = ?, start_time = ?, end_time = ?, recurrence = ?, days_of_week = ?, notes = ?, color = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverEv.title, serverEv.date, serverEv.start_time, serverEv.end_time, serverEv.recurrence, serverEv.days_of_week, serverEv.notes, serverEv.color, serverEv.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO calendar_events (server_id, title, date, start_time, end_time, recurrence, days_of_week, notes, color, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [serverEv.id, serverEv.title, serverEv.date, serverEv.start_time, serverEv.end_time, serverEv.recurrence, serverEv.days_of_week, serverEv.notes, serverEv.color]
    )
  }
}

