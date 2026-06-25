import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
    CREATE TABLE IF NOT EXISTS countdowns (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      title          TEXT    NOT NULL,
      target_date    TEXT    NOT NULL,
      is_recurring   INTEGER NOT NULL DEFAULT 0,
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

  // Limpieza única de las frases semilla antiguas (solo la primera vez tras
  // actualizar). Antes corría en CADA arranque: borraba en bucle frases que el
  // servidor volvía a traer (churn) y podía cargarse una frase del usuario con el
  // mismo texto. Ahora: una sola vez, y solo frases locales (server_id IS NULL).
  const seedCleanupDone = await AsyncStorage.getItem('removedSeedQuotes_v1')
  if (!seedCleanupDone) {
    for (const text of REMOVED_QUOTES) {
      await db.runAsync('DELETE FROM quotes WHERE text = ? AND server_id IS NULL', [text])
    }
    await AsyncStorage.setItem('removedSeedQuotes_v1', '1')
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
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id        INTEGER,
      name             TEXT    NOT NULL,
      muscle_group     TEXT,
      muscle_subgroup  TEXT,
      synced           INTEGER NOT NULL DEFAULT 0,
      pending_delete   INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS routine_exercises (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id         INTEGER,
      local_routine_id  INTEGER NOT NULL REFERENCES routines(id),
      local_exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      day_of_week       INTEGER NOT NULL,
      position          INTEGER NOT NULL DEFAULT 0,
      target_sets       INTEGER NOT NULL DEFAULT 3,
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
  try { await db.runAsync('ALTER TABLE exercises ADD COLUMN muscle_subgroup TEXT') } catch {}
  // Ejercicios unilaterales (un lado cada vez) y lado trabajado por serie.
  try { await db.runAsync('ALTER TABLE exercises ADD COLUMN is_unilateral INTEGER NOT NULL DEFAULT 0') } catch {}
  try { await db.runAsync("ALTER TABLE workout_sets ADD COLUMN side TEXT NOT NULL DEFAULT 'both'") } catch {}
  // Nº de series objetivo por ejercicio en la rutina (sobrecarga progresiva).
  try { await db.runAsync('ALTER TABLE routine_exercises ADD COLUMN target_sets INTEGER NOT NULL DEFAULT 3') } catch {}

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS task_lists (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      name           TEXT    NOT NULL,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS task_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      local_list_id  INTEGER NOT NULL REFERENCES task_lists(id),
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
    CREATE TABLE IF NOT EXISTS journal_entries (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      date           TEXT    NOT NULL UNIQUE,
      content        TEXT    NOT NULL DEFAULT '',
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS journal_images (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      date           TEXT    NOT NULL,
      local_uri      TEXT    NOT NULL,
      content_type   TEXT    NOT NULL DEFAULT 'image/jpeg',
      position       INTEGER NOT NULL DEFAULT 0,
      caption        TEXT,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS habit_categories (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      name           TEXT    NOT NULL,
      color          TEXT    NOT NULL DEFAULT '#7c3aed',
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS habits (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id         INTEGER,
      local_category_id INTEGER NOT NULL REFERENCES habit_categories(id),
      name              TEXT    NOT NULL,
      days_of_week      TEXT    NOT NULL DEFAULT '0,1,2,3,4,5,6',
      position          INTEGER NOT NULL DEFAULT 0,
      synced            INTEGER NOT NULL DEFAULT 0,
      pending_delete    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS habit_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id      INTEGER,
      local_habit_id INTEGER NOT NULL REFERENCES habits(id),
      date           TEXT    NOT NULL,
      synced         INTEGER NOT NULL DEFAULT 0,
      pending_delete INTEGER NOT NULL DEFAULT 0
    );
  `)

  // Red de seguridad: como mucho un log ACTIVO por (hábito, día).
  // Índice parcial → permite filas en cola de borrado (pending_delete=1).
  try {
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS uq_habit_log_active ON habit_logs(local_habit_id, date) WHERE pending_delete = 0')
  } catch {}

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

export async function pruneStaleQuotes(validServerIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM quotes WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!validServerIds.has(row.server_id)) {
      await db.runAsync('DELETE FROM quotes WHERE id = ?', [row.id])
    }
  }
}

// ── Countdowns ───────────────────────────────────────────────────────────────

export async function getCountdowns() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM countdowns WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertLocalCountdown(title, targetDate, isRecurring) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO countdowns (title, target_date, is_recurring, synced) VALUES (?, ?, ?, 0)',
    [title, targetDate, isRecurring ? 1 : 0]
  )
  return result.lastInsertRowId
}

export async function updateLocalCountdown(id, title, targetDate, isRecurring) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE countdowns SET title = ?, target_date = ?, is_recurring = ?, synced = 0 WHERE id = ?',
    [title, targetDate, isRecurring ? 1 : 0, id]
  )
}

export async function deleteLocalCountdown(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM countdowns WHERE id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE countdowns SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.runAsync('DELETE FROM countdowns WHERE id = ?', [id])
  }
}

export async function getUnsyncedCountdowns() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM countdowns WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteCountdowns() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM countdowns WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markCountdownSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE countdowns SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function purgeLocalCountdown(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM countdowns WHERE id = ?', [id])
}

export async function upsertCountdownFromServer(serverCountdown) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM countdowns WHERE server_id = ?', [serverCountdown.id])
  if (existing) {
    await db.runAsync(
      'UPDATE countdowns SET title = ?, target_date = ?, is_recurring = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverCountdown.title, serverCountdown.target_date, serverCountdown.is_recurring ? 1 : 0, serverCountdown.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO countdowns (server_id, title, target_date, is_recurring, synced) VALUES (?, ?, ?, ?, 1)',
      [serverCountdown.id, serverCountdown.title, serverCountdown.target_date, serverCountdown.is_recurring ? 1 : 0]
    )
  }
}

export async function pruneStaleCountdowns(validServerIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM countdowns WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!validServerIds.has(row.server_id)) {
      await db.runAsync('DELETE FROM countdowns WHERE id = ?', [row.id])
    }
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

export async function updateLocalRoutine(id, name) {
  const db = await openDB()
  await db.runAsync('UPDATE routines SET name = ?, synced = 0 WHERE id = ?', [name.trim(), id])
}

export async function deleteLocalRoutine(id) {
  const db = await openDB()
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync('SELECT server_id FROM routines WHERE id = ?', [id])
    const res = await db.getAllAsync('SELECT id, server_id FROM routine_exercises WHERE local_routine_id = ?', [id])
    for (const re of res) {
      if (re.server_id) {
        await db.runAsync('UPDATE routine_exercises SET pending_delete = 1 WHERE id = ?', [re.id])
      } else {
        await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', [re.id])
      }
    }
    if (row?.server_id) {
      await db.runAsync('UPDATE routines SET pending_delete = 1 WHERE id = ?', [id])
    } else {
      await db.runAsync('DELETE FROM routines WHERE id = ?', [id])
    }
  })
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

export async function pruneStaleRoutines(validServerIds) {
  const db = await openDB()
  const synced = await db.getAllAsync(
    'SELECT id, server_id FROM routines WHERE server_id IS NOT NULL AND pending_delete = 0'
  )
  for (const r of synced) {
    if (!validServerIds.has(r.server_id)) {
      await purgeLocalRoutine(r.id)
    }
  }
}

// ── Exercises ─────────────────────────────────────────────────────────────────

export async function getExercises() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM exercises WHERE pending_delete = 0 ORDER BY muscle_group, name')
}

export async function insertLocalExercise(name, muscleGroup, muscleSubgroup, isUnilateral = false) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO exercises (name, muscle_group, muscle_subgroup, is_unilateral, synced) VALUES (?, ?, ?, ?, 0)',
    [name.trim(), muscleGroup || null, muscleSubgroup || null, isUnilateral ? 1 : 0]
  )
  return result.lastInsertRowId
}

export async function updateLocalExercise(id, name, muscleGroup, muscleSubgroup, isUnilateral = false) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE exercises SET name = ?, muscle_group = ?, muscle_subgroup = ?, is_unilateral = ?, synced = 0 WHERE id = ?',
    [name.trim(), muscleGroup || null, muscleSubgroup || null, isUnilateral ? 1 : 0, id]
  )
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
      'UPDATE exercises SET name = ?, muscle_group = ?, muscle_subgroup = ?, is_unilateral = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverEx.name, serverEx.muscle_group, serverEx.muscle_subgroup ?? null, serverEx.is_unilateral ? 1 : 0, serverEx.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO exercises (server_id, name, muscle_group, muscle_subgroup, is_unilateral, synced) VALUES (?, ?, ?, ?, ?, 1)',
      [serverEx.id, serverEx.name, serverEx.muscle_group, serverEx.muscle_subgroup ?? null, serverEx.is_unilateral ? 1 : 0]
    )
  }
}

// ── Routine Exercises ─────────────────────────────────────────────────────────

export async function getAllRoutineExercises(localRoutineId) {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT re.id, re.local_exercise_id, re.day_of_week, re.position, re.target_sets,
           e.name as exercise_name, e.muscle_group, e.is_unilateral
    FROM routine_exercises re
    JOIN exercises e ON e.id = re.local_exercise_id
    WHERE re.local_routine_id = ? AND re.pending_delete = 0
    ORDER BY re.day_of_week, re.position
  `, [localRoutineId])
}

export async function insertRoutineExercise(localRoutineId, localExerciseId, dayOfWeek, position, targetSets = 3) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO routine_exercises (local_routine_id, local_exercise_id, day_of_week, position, target_sets, synced) VALUES (?, ?, ?, ?, ?, 0)',
    [localRoutineId, localExerciseId, dayOfWeek, position, targetSets]
  )
  return result.lastInsertRowId
}

export async function deleteRoutineExercise(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM routine_exercises WHERE id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE routine_exercises SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', [id])
  }
}

export async function updateRoutineExercisePosition(id, position) {
  const db = await openDB()
  await db.runAsync('UPDATE routine_exercises SET position = ?, synced = 0 WHERE id = ?', [position, id])
}

export async function updateRoutineExerciseTargetSets(id, targetSets) {
  const db = await openDB()
  await db.runAsync('UPDATE routine_exercises SET target_sets = ?, synced = 0 WHERE id = ?', [targetSets, id])
}

export async function getUnsyncedRoutineExercises() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT re.*, r.server_id as server_routine_id, e.server_id as server_exercise_id
    FROM routine_exercises re
    JOIN routines r ON r.id = re.local_routine_id
    JOIN exercises e ON e.id = re.local_exercise_id
    WHERE re.synced = 0 AND re.pending_delete = 0
      AND r.server_id IS NOT NULL
      AND e.server_id IS NOT NULL
  `)
}

export async function getPendingDeleteRoutineExercises() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM routine_exercises WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markRoutineExerciseSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE routine_exercises SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function purgeLocalRoutineExercise(localId) {
  const db = await openDB()
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', [localId])
}

export async function upsertRoutineExerciseFromServer(serverRE) {
  const db = await openDB()
  const routineRow = await db.getFirstAsync('SELECT id FROM routines WHERE server_id = ?', [serverRE.routine_id])
  const exerciseRow = await db.getFirstAsync('SELECT id FROM exercises WHERE server_id = ?', [serverRE.exercise_id])
  const localRoutineId = routineRow?.id
  const localExerciseId = exerciseRow?.id
  if (!localRoutineId || !localExerciseId) return
  const existing = await db.getFirstAsync('SELECT id FROM routine_exercises WHERE server_id = ?', [serverRE.id])
  if (existing) {
    await db.runAsync(
      'UPDATE routine_exercises SET local_routine_id=?, local_exercise_id=?, day_of_week=?, position=?, target_sets=?, synced=1, pending_delete=0 WHERE server_id=?',
      [localRoutineId, localExerciseId, serverRE.day_of_week, serverRE.position, serverRE.target_sets ?? 3, serverRE.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO routine_exercises (server_id, local_routine_id, local_exercise_id, day_of_week, position, target_sets, synced) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [serverRE.id, localRoutineId, localExerciseId, serverRE.day_of_week, serverRE.position, serverRE.target_sets ?? 3]
    )
  }
}

export async function pruneStaleRoutineExercises(validServerIds) {
  const db = await openDB()
  const synced = await db.getAllAsync(
    'SELECT id, server_id FROM routine_exercises WHERE server_id IS NOT NULL AND pending_delete = 0'
  )
  for (const re of synced) {
    if (!validServerIds.has(re.server_id)) {
      await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', [re.id])
    }
  }
}

export async function purgeLocalExercise(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM routine_exercises WHERE local_exercise_id = ?', [id])
  await db.runAsync('DELETE FROM workout_sets WHERE local_exercise_id = ?', [id])
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id])
}

export async function pruneStaleExercises(validServerIds) {
  const db = await openDB()
  const synced = await db.getAllAsync(
    'SELECT id, server_id FROM exercises WHERE server_id IS NOT NULL AND pending_delete = 0'
  )
  for (const ex of synced) {
    if (!validServerIds.has(ex.server_id)) await purgeLocalExercise(ex.id)
  }
}

// ── Workout Sessions ──────────────────────────────────────────────────────────

export async function getUnsyncedSessions() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT s.*, r.server_id as server_routine_id
    FROM workout_sessions s
    LEFT JOIN routines r ON r.id = s.local_routine_id
    WHERE s.synced = 0 AND s.pending_delete = 0
  `)
}

export async function getPendingDeleteSessions() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM workout_sessions WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markSessionSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE workout_sessions SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function purgeLocalSession(localId) {
  const db = await openDB()
  await db.runAsync('DELETE FROM workout_sets WHERE local_session_id = ?', [localId])
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [localId])
}

// Borra localmente las sesiones que ya no existen en el servidor (p.ej. borradas
// desde otro dispositivo). Cascada a sus sets vía purgeLocalSession.
export async function pruneStaleSessions(validServerIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM workout_sessions WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!validServerIds.has(row.server_id)) await purgeLocalSession(row.id)
  }
}

export async function upsertSessionFromServer(serverSession) {
  const db = await openDB()
  let localRoutineId = null
  if (serverSession.routine_id) {
    const row = await db.getFirstAsync('SELECT id FROM routines WHERE server_id = ?', [serverSession.routine_id])
    localRoutineId = row?.id ?? null
  }
  const existing = await db.getFirstAsync('SELECT id FROM workout_sessions WHERE server_id = ?', [serverSession.id])
  if (existing) {
    await db.runAsync(
      'UPDATE workout_sessions SET local_routine_id=?, day_of_week=?, date=?, note=?, synced=1, pending_delete=0 WHERE server_id=?',
      [localRoutineId, serverSession.day_of_week, serverSession.date, serverSession.note, serverSession.id]
    )
    return existing.id
  } else {
    const result = await db.runAsync(
      'INSERT INTO workout_sessions (server_id, local_routine_id, day_of_week, date, note, synced) VALUES (?, ?, ?, ?, ?, 1)',
      [serverSession.id, localRoutineId, serverSession.day_of_week, serverSession.date, serverSession.note]
    )
    return result.lastInsertRowId
  }
}

export async function getAllSessions() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT s.id, s.date, s.day_of_week, s.note,
           r.name as routine_name,
           COUNT(DISTINCT ws.local_exercise_id || '-' || ws.set_number) as set_count
    FROM workout_sessions s
    LEFT JOIN routines r ON r.id = s.local_routine_id
    LEFT JOIN workout_sets ws ON ws.local_session_id = s.id AND ws.pending_delete = 0
    WHERE s.pending_delete = 0
    GROUP BY s.id
    ORDER BY s.date DESC, s.id DESC
  `)
}

export async function getExerciseProgression(localExerciseId) {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT s.date, MAX(ws.weight) as max_weight
    FROM workout_sets ws
    JOIN workout_sessions s ON s.id = ws.local_session_id
    WHERE ws.local_exercise_id = ? AND ws.pending_delete = 0
    GROUP BY s.date
    ORDER BY s.date ASC
  `, [localExerciseId])
}

// Series del entreno previo más reciente que incluya este ejercicio (sobrecarga
// progresiva: "lo que hiciste la última vez"). Con `beforeDate` se ignoran las
// sesiones de esa fecha o posteriores, para ver el anterior y no el de hoy.
export async function getLastPerformance(localExerciseId, beforeDate = null) {
  const db = await openDB()
  const params = [localExerciseId]
  let dateFilter = ''
  if (beforeDate) { dateFilter = 'AND s.date < ?'; params.push(beforeDate) }
  const session = await db.getFirstAsync(`
    SELECT s.id, s.date
    FROM workout_sessions s
    JOIN workout_sets ws ON ws.local_session_id = s.id
    WHERE ws.local_exercise_id = ? AND ws.pending_delete = 0 AND s.pending_delete = 0
      ${dateFilter}
    ORDER BY s.date DESC, s.id DESC
    LIMIT 1
  `, params)
  if (!session) return null
  const sets = await db.getAllAsync(`
    SELECT set_number, weight, reps, note, side
    FROM workout_sets
    WHERE local_session_id = ? AND local_exercise_id = ? AND pending_delete = 0
    ORDER BY set_number, side
  `, [session.id, localExerciseId])
  return { session_id: session.id, date: session.date, sets }
}

export async function getSetsForSession(localSessionId) {
  const db = await openDB()
  return db.getAllAsync(
    'SELECT ws.*, e.name as exercise_name FROM workout_sets ws JOIN exercises e ON e.id = ws.local_exercise_id WHERE ws.local_session_id = ? AND ws.pending_delete = 0 ORDER BY ws.local_exercise_id, ws.set_number',
    [localSessionId]
  )
}

export async function insertWorkoutSession(localRoutineId, dayOfWeek, date, note) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO workout_sessions (local_routine_id, day_of_week, date, note, synced) VALUES (?, ?, ?, ?, 0)',
    [localRoutineId || null, dayOfWeek ?? null, date, note || null]
  )
  return result.lastInsertRowId
}

// ── Workout Sets ──────────────────────────────────────────────────────────────

export async function getUnsyncedSets() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT ws.*, s.server_id as server_session_id, e.server_id as server_exercise_id
    FROM workout_sets ws
    JOIN workout_sessions s ON s.id = ws.local_session_id
    JOIN exercises e ON e.id = ws.local_exercise_id
    WHERE ws.synced = 0 AND ws.pending_delete = 0
      AND s.server_id IS NOT NULL
      AND e.server_id IS NOT NULL
  `)
}

export async function getPendingDeleteSets() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM workout_sets WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markSetSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE workout_sets SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function purgeLocalSet(localId) {
  const db = await openDB()
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', [localId])
}

// Borra localmente las series que ya no existen en el servidor.
export async function pruneStaleSets(validServerIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM workout_sets WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!validServerIds.has(row.server_id)) await db.runAsync('DELETE FROM workout_sets WHERE id = ?', [row.id])
  }
}

export async function upsertSetFromServer(serverSet) {
  const db = await openDB()
  const sessionRow = await db.getFirstAsync('SELECT id FROM workout_sessions WHERE server_id = ?', [serverSet.session_id])
  const exerciseRow = await db.getFirstAsync('SELECT id FROM exercises WHERE server_id = ?', [serverSet.exercise_id])
  const localSessionId = sessionRow?.id
  const localExerciseId = exerciseRow?.id
  if (!localSessionId || !localExerciseId) return
  const existing = await db.getFirstAsync('SELECT id FROM workout_sets WHERE server_id = ?', [serverSet.id])
  if (existing) {
    await db.runAsync(
      'UPDATE workout_sets SET local_session_id=?, local_exercise_id=?, set_number=?, weight=?, reps=?, note=?, side=?, synced=1, pending_delete=0 WHERE server_id=?',
      [localSessionId, localExerciseId, serverSet.set_number, serverSet.weight, serverSet.reps, serverSet.note, serverSet.side ?? 'both', serverSet.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO workout_sets (server_id, local_session_id, local_exercise_id, set_number, weight, reps, note, side, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [serverSet.id, localSessionId, localExerciseId, serverSet.set_number, serverSet.weight, serverSet.reps, serverSet.note, serverSet.side ?? 'both']
    )
  }
}

export async function insertWorkoutSet(localSessionId, localExerciseId, setNumber, weight, reps, note, side = 'both') {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO workout_sets (local_session_id, local_exercise_id, set_number, weight, reps, note, side, synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
    [localSessionId, localExerciseId, setNumber, weight, reps, note || null, side]
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
  await db.withTransactionAsync(async () => {
    const sessions = await db.getAllAsync('SELECT id FROM workout_sessions WHERE local_routine_id = ?', [id])
    for (const s of sessions) {
      await db.runAsync('DELETE FROM workout_sets WHERE local_session_id = ?', [s.id])
    }
    await db.runAsync('DELETE FROM workout_sessions WHERE local_routine_id = ?', [id])
    await db.runAsync('DELETE FROM routine_exercises WHERE local_routine_id = ?', [id])
    await db.runAsync('DELETE FROM routines WHERE id = ?', [id])
  })
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
  return db.getFirstAsync('SELECT * FROM routines WHERE is_active = 1 AND pending_delete = 0 LIMIT 1')
}

export async function setActiveRoutine(localId) {
  const db = await openDB()
  await db.runAsync('UPDATE routines SET is_active = 0')
  await db.runAsync('UPDATE routines SET is_active = 1 WHERE id = ?', [localId])
}

export async function restoreActiveRoutineByServerId(serverId) {
  const db = await openDB()
  const row = await db.getFirstAsync(
    'SELECT id FROM routines WHERE server_id = ? AND pending_delete = 0',
    [serverId]
  )
  if (row) {
    await db.runAsync('UPDATE routines SET is_active = 0')
    await db.runAsync('UPDATE routines SET is_active = 1 WHERE id = ?', [row.id])
  }
}

export async function getActiveTrainingDays() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT DISTINCT re.day_of_week
    FROM routine_exercises re
    JOIN routines r ON r.id = re.local_routine_id
    WHERE r.is_active = 1 AND r.pending_delete = 0 AND re.pending_delete = 0
  `)
}

// ── Task Lists ───────────────────────────────────────────────────────────────

export async function getTaskLists() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM task_lists WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertTaskList(name) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO task_lists (name, synced) VALUES (?, 0)',
    [name.trim()]
  )
  return result.lastInsertRowId
}

export async function deleteTaskList(id) {
  const db = await openDB()
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync('SELECT server_id FROM task_lists WHERE id = ?', [id])
    if (row?.server_id) {
      await db.runAsync('UPDATE task_lists SET pending_delete = 1 WHERE id = ?', [id])
      await db.runAsync('UPDATE task_items SET pending_delete = 1 WHERE local_list_id = ? AND server_id IS NOT NULL', [id])
      await db.runAsync('DELETE FROM task_items WHERE local_list_id = ? AND server_id IS NULL', [id])
    } else {
      await db.runAsync('DELETE FROM task_items WHERE local_list_id = ?', [id])
      await db.runAsync('DELETE FROM task_lists WHERE id = ?', [id])
    }
  })
}

export async function deleteLocalTaskList(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM task_items WHERE local_list_id = ?', [id])
  await db.runAsync('DELETE FROM task_lists WHERE id = ?', [id])
}

export async function getUnsyncedTaskLists() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM task_lists WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteTaskLists() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM task_lists WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markTaskListSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE task_lists SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function upsertTaskListFromServer(serverList) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM task_lists WHERE server_id = ?', [serverList.id])
  if (existing) {
    await db.runAsync(
      'UPDATE task_lists SET name = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverList.name, serverList.id]
    )
    return existing.id
  } else {
    const result = await db.runAsync(
      'INSERT INTO task_lists (server_id, name, synced) VALUES (?, ?, 1)',
      [serverList.id, serverList.name]
    )
    return result.lastInsertRowId
  }
}

// ── Task Items ───────────────────────────────────────────────────────────────

export async function getTaskItems(localListId) {
  const db = await openDB()
  return db.getAllAsync(
    'SELECT * FROM task_items WHERE local_list_id = ? AND pending_delete = 0 ORDER BY id ASC',
    [localListId]
  )
}

export async function insertTaskItem(localListId, title) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO task_items (local_list_id, title, done, synced) VALUES (?, ?, 0, 0)',
    [localListId, title.trim()]
  )
  return result.lastInsertRowId
}

export async function toggleTaskItem(id, done) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE task_items SET done = ?, synced = 0 WHERE id = ?',
    [done ? 1 : 0, id]
  )
}

export async function deleteTaskItem(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id FROM task_items WHERE id = ?', [id])
  if (row?.server_id) {
    await db.runAsync('UPDATE task_items SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.runAsync('DELETE FROM task_items WHERE id = ?', [id])
  }
}

export async function deleteLocalTaskItem(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM task_items WHERE id = ?', [id])
}

export async function getUnsyncedTaskItems() {
  const db = await openDB()
  return db.getAllAsync(`
    SELECT i.*, l.server_id as list_server_id
    FROM task_items i
    JOIN task_lists l ON l.id = i.local_list_id
    WHERE i.synced = 0 AND i.pending_delete = 0 AND l.server_id IS NOT NULL
  `)
}

export async function getPendingDeleteTaskItems() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM task_items WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markTaskItemSynced(localId, serverId) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE task_items SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function upsertTaskItemFromServer(serverItem, localListId) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM task_items WHERE server_id = ?', [serverItem.id])
  if (existing) {
    await db.runAsync(
      'UPDATE task_items SET title = ?, done = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverItem.title, serverItem.done ? 1 : 0, serverItem.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO task_items (server_id, local_list_id, title, done, synced) VALUES (?, ?, ?, ?, 1)',
      [serverItem.id, localListId, serverItem.title, serverItem.done ? 1 : 0]
    )
  }
}

export async function pruneStaleTaskLists(validServerIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM task_lists WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!validServerIds.has(row.server_id)) {
      await db.runAsync('DELETE FROM task_items WHERE local_list_id = ?', [row.id])
      await db.runAsync('DELETE FROM task_lists WHERE id = ?', [row.id])
    }
  }
}

export async function pruneStaleTaskItemsForList(localListId, validServerItemIds) {
  const db = await openDB()
  const rows = await db.getAllAsync(
    'SELECT id, server_id FROM task_items WHERE local_list_id = ? AND server_id IS NOT NULL',
    [localListId]
  )
  for (const row of rows) {
    if (!validServerItemIds.has(row.server_id)) {
      await db.runAsync('DELETE FROM task_items WHERE id = ?', [row.id])
    }
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

export async function pruneStaleCalendarEvents(serverIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM calendar_events WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!serverIds.has(row.server_id)) await db.runAsync('DELETE FROM calendar_events WHERE id = ?', [row.id])
  }
}

// ── Journal ───────────────────────────────────────────────────────────────────

export async function getTodayJournalEntry() {
  const db = await openDB()
  const today = new Date().toLocaleDateString('sv')
  return db.getFirstAsync('SELECT * FROM journal_entries WHERE date = ? AND pending_delete = 0', [today])
}

export async function getAllJournalEntries() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM journal_entries WHERE pending_delete = 0 ORDER BY date DESC')
}

export async function saveJournalEntry(content) {
  const db = await openDB()
  const today = new Date().toLocaleDateString('sv')
  const existing = await getTodayJournalEntry()
  if (existing) {
    await db.runAsync('UPDATE journal_entries SET content = ?, synced = 0 WHERE id = ?', [content, existing.id])
    return existing.id
  } else {
    const result = await db.runAsync(
      'INSERT INTO journal_entries (date, content, synced) VALUES (?, ?, 0)',
      [today, content]
    )
    return result.lastInsertRowId
  }
}

export async function getJournalStreak() {
  const db = await openDB()
  const rows = await db.getAllAsync(
    "SELECT date FROM journal_entries WHERE content != '' AND pending_delete = 0 ORDER BY date DESC"
  )
  if (rows.length === 0) return 0
  const dates = new Set(rows.map(r => r.date))
  let streak = 0
  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  const todayStr = cursor.toLocaleDateString('sv')
  if (!dates.has(todayStr)) cursor.setDate(cursor.getDate() - 1)
  while (true) {
    const d = cursor.toLocaleDateString('sv')
    if (!dates.has(d)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export async function getUnsyncedJournalEntries() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM journal_entries WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteJournalEntries() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM journal_entries WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markJournalEntrySynced(id, serverId) {
  const db = await openDB()
  await db.runAsync('UPDATE journal_entries SET synced = 1, server_id = ? WHERE id = ?', [serverId, id])
}

export async function purgeLocalJournalEntry(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM journal_entries WHERE id = ?', [id])
}

function mergeJournalContent(local, remote) {
  const l = local?.trim() ?? ''
  const r = remote?.trim() ?? ''
  if (!l) return r
  if (!r) return l
  if (l === r) return l
  // Idempotencia: si una versión ya contiene a la otra (caso típico al sincronizar
  // entre 3+ dispositivos), no re-concatenamos — evitamos que el contenido crezca.
  if (l.includes(r)) return l
  if (r.includes(l)) return r
  return `${l}\n\n---\n\n${r}`
}

export async function upsertJournalEntryFromServer(entry) {
  const db = await openDB()
  const existingById = await db.getFirstAsync('SELECT * FROM journal_entries WHERE server_id = ?', [entry.id])
  if (existingById) {
    // Si la copia local es un espejo limpio del servidor (synced=1), el servidor
    // manda y sobrescribimos. Solo fusionamos si hay ediciones locales sin subir
    // (synced=0): ahí sí es un conflicto real entre dos dispositivos.
    const content = existingById.synced ? entry.content : mergeJournalContent(existingById.content, entry.content)
    const needsSync = content === entry.content ? 1 : 0
    await db.runAsync(
      'UPDATE journal_entries SET date = ?, content = ?, synced = ? WHERE server_id = ?',
      [entry.date, content, needsSync, entry.id]
    )
    return
  }
  const existingByDate = await db.getFirstAsync('SELECT * FROM journal_entries WHERE date = ?', [entry.date])
  if (existingByDate) {
    const content = existingByDate.synced ? entry.content : mergeJournalContent(existingByDate.content, entry.content)
    const needsSync = content === entry.content ? 1 : 0
    await db.runAsync(
      'UPDATE journal_entries SET server_id = ?, content = ?, synced = ? WHERE id = ?',
      [entry.id, content, needsSync, existingByDate.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO journal_entries (server_id, date, content, synced) VALUES (?, ?, ?, 1)',
      [entry.id, entry.date, entry.content]
    )
  }
}

export async function pruneStaleJournalEntries(serverIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM journal_entries WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!serverIds.has(row.server_id)) await db.runAsync('DELETE FROM journal_entries WHERE id = ?', [row.id])
  }
}

// ── Journal Images ──────────────────────────────────────────────────────────
// Los bytes son ficheros en el almacenamiento de la app (imageStore.js); aquí
// solo el metadato + la URI local. Las funciones que borran filas devuelven la
// local_uri afectada para que la pantalla elimine también el fichero.

export async function getJournalImagesForDate(date) {
  const db = await openDB()
  return db.getAllAsync(
    'SELECT * FROM journal_images WHERE date = ? AND pending_delete = 0 ORDER BY position, id',
    [date]
  )
}

export async function insertLocalJournalImage(date, localUri, contentType, position = 0, caption = null) {
  const db = await openDB()
  const result = await db.runAsync(
    'INSERT INTO journal_images (date, local_uri, content_type, position, caption, synced) VALUES (?, ?, ?, ?, ?, 0)',
    [date, localUri, contentType, position, caption]
  )
  return result.lastInsertRowId
}

export async function deleteLocalJournalImage(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT server_id, local_uri FROM journal_images WHERE id = ?', [id])
  if (!row) return null
  if (row.server_id) {
    await db.runAsync('UPDATE journal_images SET pending_delete = 1 WHERE id = ?', [id])
    return null
  }
  await db.runAsync('DELETE FROM journal_images WHERE id = ?', [id])
  return row.local_uri
}

export async function getUnsyncedJournalImages() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM journal_images WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteJournalImages() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM journal_images WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markJournalImageSynced(id, serverId) {
  const db = await openDB()
  await db.runAsync('UPDATE journal_images SET synced = 1, server_id = ? WHERE id = ?', [serverId, id])
}

export async function purgeLocalJournalImage(id) {
  const db = await openDB()
  const row = await db.getFirstAsync('SELECT local_uri FROM journal_images WHERE id = ?', [id])
  await db.runAsync('DELETE FROM journal_images WHERE id = ?', [id])
  return row?.local_uri ?? null
}

export async function localJournalImageByServerId(serverId) {
  const db = await openDB()
  return db.getFirstAsync('SELECT * FROM journal_images WHERE server_id = ?', [serverId])
}

export async function insertSyncedJournalImage(serverImg, localUri) {
  const db = await openDB()
  await db.runAsync(
    'INSERT INTO journal_images (server_id, date, local_uri, content_type, position, caption, synced) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [serverImg.id, serverImg.date, localUri, serverImg.content_type, serverImg.position ?? 0, serverImg.caption ?? null]
  )
}

export async function pruneStaleJournalImages(validServerIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id, local_uri FROM journal_images WHERE server_id IS NOT NULL AND pending_delete = 0')
  const removed = []
  for (const row of rows) {
    if (!validServerIds.has(row.server_id)) {
      await db.runAsync('DELETE FROM journal_images WHERE id = ?', [row.id])
      removed.push(row.local_uri)
    }
  }
  return removed
}


// ── Habits ────────────────────────────────────────────────────────────────────

export async function getHabitCategories() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM habit_categories WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertHabitCategory(data) {
  const db = await openDB()
  await db.runAsync('INSERT INTO habit_categories (name, color, synced) VALUES (?, ?, 0)', [data.name, data.color])
}

export async function updateHabitCategory(id, data) {
  const db = await openDB()
  await db.runAsync('UPDATE habit_categories SET name = ?, color = ?, synced = 0 WHERE id = ?', [data.name, data.color, id])
}

export async function deleteLocalHabitCategory(id) {
  const db = await openDB()
  await db.withTransactionAsync(async () => {
    const cat = await db.getFirstAsync('SELECT server_id FROM habit_categories WHERE id = ?', [id])
    const habitsInCat = await db.getAllAsync('SELECT id, server_id FROM habits WHERE local_category_id = ?', [id])
    for (const h of habitsInCat) {
      if (h.server_id) {
        await db.runAsync('UPDATE habit_logs SET pending_delete = 1 WHERE local_habit_id = ? AND server_id IS NOT NULL', [h.id])
        await db.runAsync('DELETE FROM habit_logs WHERE local_habit_id = ? AND server_id IS NULL', [h.id])
        await db.runAsync('UPDATE habits SET pending_delete = 1 WHERE id = ?', [h.id])
      } else {
        await db.runAsync('DELETE FROM habit_logs WHERE local_habit_id = ?', [h.id])
        await db.runAsync('DELETE FROM habits WHERE id = ?', [h.id])
      }
    }
    if (cat?.server_id) {
      await db.runAsync('UPDATE habit_categories SET pending_delete = 1 WHERE id = ?', [id])
    } else {
      await db.runAsync('DELETE FROM habit_categories WHERE id = ?', [id])
    }
  })
}

export async function getHabits() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM habits WHERE pending_delete = 0 ORDER BY local_category_id, position ASC')
}

export async function insertHabit(data) {
  const db = await openDB()
  await db.runAsync(
    'INSERT INTO habits (local_category_id, name, days_of_week, position, synced) VALUES (?, ?, ?, ?, 0)',
    [data.local_category_id, data.name, data.days_of_week ?? '0,1,2,3,4,5,6', data.position ?? 0]
  )
}

export async function updateHabit(id, data) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE habits SET name = ?, days_of_week = ?, position = ?, synced = 0 WHERE id = ?',
    [data.name, data.days_of_week ?? '0,1,2,3,4,5,6', data.position ?? 0, id]
  )
}

export async function deleteLocalHabit(id) {
  const db = await openDB()
  await db.withTransactionAsync(async () => {
    const h = await db.getFirstAsync('SELECT server_id FROM habits WHERE id = ?', [id])
    if (h?.server_id) {
      await db.runAsync('UPDATE habit_logs SET pending_delete = 1 WHERE local_habit_id = ? AND server_id IS NOT NULL', [id])
      await db.runAsync('DELETE FROM habit_logs WHERE local_habit_id = ? AND server_id IS NULL', [id])
      await db.runAsync('UPDATE habits SET pending_delete = 1 WHERE id = ?', [id])
    } else {
      await db.runAsync('DELETE FROM habit_logs WHERE local_habit_id = ?', [id])
      await db.runAsync('DELETE FROM habits WHERE id = ?', [id])
    }
  })
}

export async function getHabitLogs(month) {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM habit_logs WHERE pending_delete = 0 AND date LIKE ?', [`${month}%`])
}

export async function toggleHabitLog(localHabitId, date) {
  const db = await openDB()
  const existing = await db.getFirstAsync(
    'SELECT * FROM habit_logs WHERE local_habit_id = ? AND date = ? AND pending_delete = 0',
    [localHabitId, date]
  )
  if (existing) {
    if (existing.server_id) {
      await db.runAsync('UPDATE habit_logs SET pending_delete = 1 WHERE id = ?', [existing.id])
    } else {
      await db.runAsync('DELETE FROM habit_logs WHERE id = ?', [existing.id])
    }
  } else {
    await db.runAsync('INSERT INTO habit_logs (local_habit_id, date, synced) VALUES (?, ?, 0)', [localHabitId, date])
  }
}

export async function getUnsyncedHabitCategories() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM habit_categories WHERE synced = 0 AND pending_delete = 0')
}
export async function getPendingDeleteHabitCategories() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM habit_categories WHERE pending_delete = 1 AND server_id IS NOT NULL')
}
export async function markHabitCategorySynced(id, serverId) {
  const db = await openDB()
  await db.runAsync('UPDATE habit_categories SET synced = 1, server_id = ? WHERE id = ?', [serverId, id])
}
export async function purgeLocalHabitCategory(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM habit_categories WHERE id = ?', [id])
}
export async function upsertHabitCategoryFromServer(cat) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM habit_categories WHERE server_id = ?', [cat.id])
  if (existing) {
    await db.runAsync('UPDATE habit_categories SET name = ?, color = ?, synced = 1, pending_delete = 0 WHERE server_id = ?', [cat.name, cat.color, cat.id])
  } else {
    await db.runAsync('INSERT INTO habit_categories (server_id, name, color, synced) VALUES (?, ?, ?, 1)', [cat.id, cat.name, cat.color])
  }
}
export async function pruneStaleHabitCategories(serverIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM habit_categories WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!serverIds.has(row.server_id)) await db.runAsync('DELETE FROM habit_categories WHERE id = ?', [row.id])
  }
}

export async function getUnsyncedHabits() {
  const db = await openDB()
  return db.getAllAsync('SELECT h.*, c.server_id AS cat_server_id FROM habits h JOIN habit_categories c ON h.local_category_id = c.id WHERE h.synced = 0 AND h.pending_delete = 0 AND c.server_id IS NOT NULL')
}
export async function getPendingDeleteHabits() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM habits WHERE pending_delete = 1 AND server_id IS NOT NULL')
}
export async function markHabitSynced(id, serverId) {
  const db = await openDB()
  await db.runAsync('UPDATE habits SET synced = 1, server_id = ? WHERE id = ?', [serverId, id])
}
export async function purgeLocalHabit(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM habits WHERE id = ?', [id])
}
export async function upsertHabitFromServer(habit, localCategoryId) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM habits WHERE server_id = ?', [habit.id])
  if (existing) {
    await db.runAsync(
      'UPDATE habits SET name = ?, days_of_week = ?, position = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [habit.name, habit.days_of_week, habit.position, habit.id]
    )
  } else {
    await db.runAsync(
      'INSERT INTO habits (server_id, local_category_id, name, days_of_week, position, synced) VALUES (?, ?, ?, ?, ?, 1)',
      [habit.id, localCategoryId, habit.name, habit.days_of_week, habit.position]
    )
  }
}
export async function pruneStaleHabits(serverIds) {
  const db = await openDB()
  const rows = await db.getAllAsync('SELECT id, server_id FROM habits WHERE server_id IS NOT NULL AND pending_delete = 0')
  for (const row of rows) {
    if (!serverIds.has(row.server_id)) await db.runAsync('DELETE FROM habits WHERE id = ?', [row.id])
  }
}

export async function getUnsyncedHabitLogs() {
  const db = await openDB()
  return db.getAllAsync('SELECT l.*, h.server_id AS habit_server_id FROM habit_logs l JOIN habits h ON l.local_habit_id = h.id WHERE l.synced = 0 AND l.pending_delete = 0 AND h.server_id IS NOT NULL')
}
export async function getPendingDeleteHabitLogs() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM habit_logs WHERE pending_delete = 1 AND server_id IS NOT NULL')
}
export async function markHabitLogSynced(id, serverId) {
  const db = await openDB()
  await db.runAsync('UPDATE habit_logs SET synced = 1, server_id = ? WHERE id = ?', [serverId, id])
}
export async function purgeLocalHabitLog(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM habit_logs WHERE id = ?', [id])
}
export async function upsertHabitLogFromServer(log, localHabitId) {
  const db = await openDB()
  const existing = await db.getFirstAsync('SELECT id FROM habit_logs WHERE server_id = ?', [log.id])
  if (existing) {
    await db.runAsync('UPDATE habit_logs SET date = ?, synced = 1 WHERE server_id = ?', [log.date, log.id])
  } else {
    await db.runAsync('INSERT INTO habit_logs (server_id, local_habit_id, date, synced) VALUES (?, ?, ?, 1)', [log.id, localHabitId, log.date])
  }
}
// IMPORTANTE: el servidor solo devuelve los logs del `month` pedido, así que el
// prune debe limitarse a ESE mes. Si no, borraría los logs locales sincronizados
// de los demás meses (no están en serverIds porque no se pidieron).
export async function pruneStaleHabitLogs(serverIds, month) {
  const db = await openDB()
  const rows = await db.getAllAsync(
    'SELECT id, server_id FROM habit_logs WHERE server_id IS NOT NULL AND pending_delete = 0 AND date LIKE ?',
    [`${month}%`]
  )
  for (const row of rows) {
    if (!serverIds.has(row.server_id)) await db.runAsync('DELETE FROM habit_logs WHERE id = ?', [row.id])
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportAllData() {
  const db = await openDB()
  const tables = [
    'body_weight', 'quotes', 'countdowns', 'routines', 'exercises', 'routine_exercises',
    'workout_sessions', 'workout_sets', 'task_lists', 'task_items',
    'calendar_events', 'journal_entries', 'journal_images', 'habit_categories', 'habits', 'habit_logs',
  ]
  const out = { exportedAt: new Date().toISOString(), tables: {} }
  for (const table of tables) {
    out.tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`)
  }
  return out
}
