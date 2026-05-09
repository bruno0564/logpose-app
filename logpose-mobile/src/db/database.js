import * as SQLite from 'expo-sqlite'

let db

const DEFAULT_QUOTES = [
  'As long as I live, there are infinite chances.',
]

const REMOVED_QUOTES = [
  'El progreso, no la perfección.',
  'Un día a la vez.',
  'Cada registro cuenta.',
  'Lo que se mide, mejora.',
  'Constancia sobre intensidad.',
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
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      muscle_group TEXT,
      notes        TEXT,
      position     INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workout_sets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      date        TEXT NOT NULL,
      set_number  INTEGER NOT NULL,
      weight      REAL NOT NULL,
      reps        INTEGER NOT NULL
    );
  `)
  for (const text of REMOVED_QUOTES) {
    await db.runAsync('DELETE FROM quotes WHERE text = ?', [text])
  }
  for (const text of DEFAULT_QUOTES) {
    const exists = await db.getFirstAsync('SELECT id FROM quotes WHERE text = ?', [text])
    if (!exists) await db.runAsync('INSERT INTO quotes (text) VALUES (?)', [text])
  }
  return db
}

export async function getQuotes() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM quotes ORDER BY id ASC')
}

export async function addQuote(text) {
  const db = await openDB()
  await db.runAsync('INSERT INTO quotes (text) VALUES (?)', [text.trim()])
}

export async function deleteQuote(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM quotes WHERE id = ?', [id])
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

// ── Exercises ─────────────────────────────────────────────────────────────────

export async function getExercises() {
  const db = await openDB()
  return db.getAllAsync('SELECT * FROM exercises ORDER BY position ASC, id ASC')
}

export async function addExercise(name, muscle_group, notes) {
  const db = await openDB()
  const max = await db.getFirstAsync('SELECT MAX(position) as p FROM exercises')
  await db.runAsync(
    'INSERT INTO exercises (name, muscle_group, notes, position) VALUES (?, ?, ?, ?)',
    [name.trim(), muscle_group?.trim() || null, notes?.trim() || null, (max.p ?? 0) + 1]
  )
}

export async function updateExercise(id, name, muscle_group, notes) {
  const db = await openDB()
  await db.runAsync(
    'UPDATE exercises SET name = ?, muscle_group = ?, notes = ? WHERE id = ?',
    [name.trim(), muscle_group?.trim() || null, notes?.trim() || null, id]
  )
}

export async function deleteExercise(id) {
  const db = await openDB()
  await db.runAsync('DELETE FROM workout_sets WHERE exercise_id = ?', [id])
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id])
}
