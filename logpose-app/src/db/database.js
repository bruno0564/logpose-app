import Database from '@tauri-apps/plugin-sql'

// instancia única de la DB, se reutiliza en todas las llamadas
let db

// abre la conexión con SQLite y crea las tablas si no existen
// si ya está abierta devuelve la misma instancia (patrón singleton)
export async function openDB() {
  if (db) return db
  const instance = await Database.load('sqlite:logpose.db')

  // server_id → id del registro en el servidor (null si aún no se ha sincronizado)
  // synced → 0 = pendiente de subir al servidor, 1 = sincronizado
  // pending_delete → 1 = marcado para borrar del servidor, 0 = normal
  await instance.execute(`CREATE TABLE IF NOT EXISTS body_weight (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id      INTEGER,
    weight         REAL    NOT NULL,
    date           TEXT    NOT NULL,
    note           TEXT,
    synced         INTEGER NOT NULL DEFAULT 0,
    pending_delete INTEGER NOT NULL DEFAULT 0
  )`)

  await instance.execute(`CREATE TABLE IF NOT EXISTS quotes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id      INTEGER,
    text           TEXT    NOT NULL,
    author         TEXT,
    synced         INTEGER NOT NULL DEFAULT 0,
    pending_delete INTEGER NOT NULL DEFAULT 0
  )`)


  await instance.execute(`CREATE TABLE IF NOT EXISTS exercises (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id      INTEGER,
    name           TEXT    NOT NULL,
    muscle_group   TEXT,
    notes          TEXT,
    position       INTEGER NOT NULL DEFAULT 0,
    synced         INTEGER NOT NULL DEFAULT 0,
    pending_delete INTEGER NOT NULL DEFAULT 0
  )`)

  await instance.execute(`CREATE TABLE IF NOT EXISTS todo_lists (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id      INTEGER,
    name           TEXT    NOT NULL,
    synced         INTEGER NOT NULL DEFAULT 0,
    pending_delete INTEGER NOT NULL DEFAULT 0
  )`)

  await instance.execute(`CREATE TABLE IF NOT EXISTS todo_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id      INTEGER,
    local_list_id  INTEGER NOT NULL REFERENCES todo_lists(id),
    title          TEXT    NOT NULL,
    done           INTEGER NOT NULL DEFAULT 0,
    synced         INTEGER NOT NULL DEFAULT 0,
    pending_delete INTEGER NOT NULL DEFAULT 0
  )`)

  db = instance
  return db
}

// ── Body Weight ────────────────────────────────────────────────────────────────

// devuelve todos los registros excepto los marcados para borrar, ordenados por fecha
export async function getLocalEntries() {
  const db = await openDB()
  return db.select('SELECT * FROM body_weight WHERE pending_delete = 0 ORDER BY date DESC')
}

// devuelve solo el registro más reciente (para mostrarlo en Home)
export async function getLatestWeight() {
  const db = await openDB()
  const rows = await db.select('SELECT * FROM body_weight WHERE pending_delete = 0 ORDER BY date DESC LIMIT 1')
  return rows[0] ?? null
}

// inserta un registro nuevo con synced=0 (pendiente de subir al servidor)
export async function insertLocalEntry(weight, date, note) {
  const db = await openDB()
  const result = await db.execute(
    'INSERT INTO body_weight (weight, date, note, synced) VALUES (?, ?, ?, 0)',
    [weight, date, note || null]
  )
  return result.lastInsertId
}

// una vez subido al servidor, guarda su server_id y marca como sincronizado
export async function markSynced(localId, serverId) {
  const db = await openDB()
  await db.execute(
    'UPDATE body_weight SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

// marca un registro para borrar del servidor (no lo borra aún de local)
// se usa cuando el registro ya tiene server_id y hay que borrarlo también en el servidor
export async function markPendingDelete(localId) {
  const db = await openDB()
  await db.execute('UPDATE body_weight SET pending_delete = 1 WHERE id = ?', [localId])
}

// borra definitivamente el registro de la DB local (tras confirmación del servidor)
export async function deleteLocalEntry(localId) {
  const db = await openDB()
  await db.execute('DELETE FROM body_weight WHERE id = ?', [localId])
}

// sincroniza un registro que viene del servidor hacia local
// si ya existe (mismo server_id) lo actualiza, si no existe lo inserta
export async function upsertFromServer(serverEntry) {
  const db = await openDB()
  const rows = await db.select('SELECT id FROM body_weight WHERE server_id = ?', [serverEntry.id])
  if (rows.length > 0) {
    await db.execute(
      'UPDATE body_weight SET weight = ?, date = ?, note = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverEntry.weight, serverEntry.date, serverEntry.note, serverEntry.id]
    )
  } else {
    await db.execute(
      'INSERT INTO body_weight (server_id, weight, date, note, synced) VALUES (?, ?, ?, ?, 1)',
      [serverEntry.id, serverEntry.weight, serverEntry.date, serverEntry.note]
    )
  }
}

// devuelve registros que aún no se han subido al servidor
export async function getUnsyncedEntries() {
  const db = await openDB()
  return db.select('SELECT * FROM body_weight WHERE synced = 0 AND pending_delete = 0')
}

// devuelve registros marcados para borrar que ya tienen server_id (hay que borrarlos en el servidor)
export async function getPendingDeletes() {
  const db = await openDB()
  return db.select('SELECT * FROM body_weight WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

// ── Quotes ────────────────────────────────────────────────────────────────

export async function getQuotes() {
  const db = await openDB()
  return db.select('SELECT * FROM quotes WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertLocalQuote(text, author) {
  const db = await openDB()
  const result = await db.execute(
    'INSERT INTO quotes (text, author, synced) VALUES (?, ?, 0)',
    [text, author || null]
  )
  return result.lastInsertId
}

export async function markQuoteSynced(localId, serverId) {
  const db = await openDB()
  await db.execute(
    'UPDATE quotes SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function markQuotePendingDelete(localId) {
  const db = await openDB()
  await db.execute('UPDATE quotes SET pending_delete = 1 WHERE id = ?', [localId])
}

export async function deleteLocalQuote(localId) {
  const db = await openDB()
  const rows = await db.select('SELECT server_id FROM quotes WHERE id = ?', [localId])
  if (rows[0]?.server_id) {
    await db.execute('UPDATE quotes SET pending_delete = 1 WHERE id = ?', [localId])
  } else {
    await db.execute('DELETE FROM quotes WHERE id = ?', [localId])
  }
}

export async function upsertQuoteFromServer(serverQuote) {
  const db = await openDB()
  const rows = await db.select('SELECT id FROM quotes WHERE server_id = ?', [serverQuote.id])
  if (rows.length > 0) {
    await db.execute(
      'UPDATE quotes SET text = ?, author = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverQuote.text, serverQuote.author, serverQuote.id]
    )
  } else {
    await db.execute(
      'INSERT INTO quotes (server_id, text, author, synced) VALUES (?, ?, ?, 1)',
      [serverQuote.id, serverQuote.text, serverQuote.author]
    )
  }
}

export async function getUnsyncedQuotes() {
  const db = await openDB()
  return db.select('SELECT * FROM quotes WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteQuotes() {
  const db = await openDB()
  return db.select('SELECT * FROM quotes WHERE pending_delete = 1 AND server_id IS NOT NULL')
}



// ── Exercises ──────────────────────────────────────────────────────────────────

export async function getExercises() {
  const db = await openDB()
  return db.select('SELECT * FROM exercises WHERE pending_delete = 0 ORDER BY position ASC, id ASC')
}

// calcula la posición máxima actual y añade el nuevo ejercicio al final
export async function addExercise(name, muscle_group, notes) {
  const db = await openDB()
  const rows = await db.select('SELECT MAX(position) as p FROM exercises')
  const maxPos = rows[0]?.p ?? 0
  await db.execute(
    'INSERT INTO exercises (name, muscle_group, notes, position, synced) VALUES (?, ?, ?, ?, 0)',
    [name.trim(), muscle_group?.trim() || null, notes?.trim() || null, maxPos + 1]
  )
}

// al editar, marca synced=0 para que el sync lo suba al servidor con los cambios
export async function updateExercise(id, name, muscle_group, notes) {
  const db = await openDB()
  await db.execute(
    'UPDATE exercises SET name = ?, muscle_group = ?, notes = ?, synced = 0 WHERE id = ?',
    [name.trim(), muscle_group?.trim() || null, notes?.trim() || null, id]
  )
}

// si el ejercicio tiene server_id lo marca para borrar (hay que borrarlo en el servidor)
// si solo existe en local, lo borra directamente
export async function deleteExercise(id) {
  const db = await openDB()
  const rows = await db.select('SELECT server_id FROM exercises WHERE id = ?', [id])
  if (rows[0]?.server_id) {
    await db.execute('UPDATE exercises SET pending_delete = 1 WHERE id = ?', [id])
  } else {
    await db.execute('DELETE FROM exercises WHERE id = ?', [id])
  }
}

export async function getUnsyncedExercises() {
  const db = await openDB()
  return db.select('SELECT * FROM exercises WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteExercises() {
  const db = await openDB()
  return db.select('SELECT * FROM exercises WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markExerciseSynced(localId, serverId) {
  const db = await openDB()
  await db.execute(
    'UPDATE exercises SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function deleteLocalExercise(localId) {
  const db = await openDB()
  await db.execute('DELETE FROM exercises WHERE id = ?', [localId])
}

export async function upsertExerciseFromServer(serverEx) {
  const db = await openDB()
  const rows = await db.select('SELECT id FROM exercises WHERE server_id = ?', [serverEx.id])
  if (rows.length > 0) {
    await db.execute(
      'UPDATE exercises SET name = ?, muscle_group = ?, notes = ?, position = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverEx.name, serverEx.muscle_group, serverEx.notes, serverEx.position, serverEx.id]
    )
  } else {
    const maxRows = await db.select('SELECT MAX(position) as p FROM exercises')
    await db.execute(
      'INSERT INTO exercises (server_id, name, muscle_group, notes, position, synced) VALUES (?, ?, ?, ?, ?, 1)',
      [serverEx.id, serverEx.name, serverEx.muscle_group, serverEx.notes, serverEx.position ?? (maxRows[0]?.p ?? 0) + 1]
    )
  }
}

// ── To-Do Lists ────────────────────────────────────────────────────────────────

export async function getTodoLists() {
  const db = await openDB()
  return db.select('SELECT * FROM todo_lists WHERE pending_delete = 0 ORDER BY id ASC')
}

export async function insertTodoList(name) {
  const db = await openDB()
  const result = await db.execute(
    'INSERT INTO todo_lists (name, synced) VALUES (?, 0)',
    [name.trim()]
  )
  return result.lastInsertId
}

// al borrar una lista también marca todos sus items como pending_delete
export async function deleteTodoList(localId) {
  const db = await openDB()
  const rows = await db.select('SELECT server_id FROM todo_lists WHERE id = ?', [localId])
  await db.execute('UPDATE todo_items SET pending_delete = 1 WHERE local_list_id = ?', [localId])
  if (rows[0]?.server_id) {
    await db.execute('UPDATE todo_lists SET pending_delete = 1 WHERE id = ?', [localId])
  } else {
    await db.execute('DELETE FROM todo_items WHERE local_list_id = ?', [localId])
    await db.execute('DELETE FROM todo_lists WHERE id = ?', [localId])
  }
}

export async function getUnsyncedTodoLists() {
  const db = await openDB()
  return db.select('SELECT * FROM todo_lists WHERE synced = 0 AND pending_delete = 0')
}

export async function getPendingDeleteTodoLists() {
  const db = await openDB()
  return db.select('SELECT * FROM todo_lists WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markTodoListSynced(localId, serverId) {
  const db = await openDB()
  await db.execute(
    'UPDATE todo_lists SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function deleteLocalTodoList(localId) {
  const db = await openDB()
  await db.execute('DELETE FROM todo_items WHERE local_list_id = ?', [localId])
  await db.execute('DELETE FROM todo_lists WHERE id = ?', [localId])
}

export async function upsertTodoListFromServer(serverList) {
  const db = await openDB()
  const rows = await db.select('SELECT id FROM todo_lists WHERE server_id = ?', [serverList.id])
  if (rows.length > 0) {
    await db.execute(
      'UPDATE todo_lists SET name = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverList.name, serverList.id]
    )
    return rows[0].id
  } else {
    const result = await db.execute(
      'INSERT INTO todo_lists (server_id, name, synced) VALUES (?, ?, 1)',
      [serverList.id, serverList.name]
    )
    return result.lastInsertId
  }
}

// ── To-Do Items ────────────────────────────────────────────────────────────────

export async function getTodoItems(localListId) {
  const db = await openDB()
  return db.select(
    'SELECT * FROM todo_items WHERE local_list_id = ? AND pending_delete = 0 ORDER BY id ASC',
    [localListId]
  )
}

export async function insertTodoItem(localListId, title) {
  const db = await openDB()
  const result = await db.execute(
    'INSERT INTO todo_items (local_list_id, title, done, synced) VALUES (?, ?, 0, 0)',
    [localListId, title.trim()]
  )
  return result.lastInsertId
}

export async function toggleTodoItem(localId, done) {
  const db = await openDB()
  await db.execute(
    'UPDATE todo_items SET done = ?, synced = 0 WHERE id = ?',
    [done ? 1 : 0, localId]
  )
}

export async function deleteTodoItem(localId) {
  const db = await openDB()
  const rows = await db.select('SELECT server_id FROM todo_items WHERE id = ?', [localId])
  if (rows[0]?.server_id) {
    await db.execute('UPDATE todo_items SET pending_delete = 1 WHERE id = ?', [localId])
  } else {
    await db.execute('DELETE FROM todo_items WHERE id = ?', [localId])
  }
}

// solo sincroniza items cuya lista ya tiene server_id (la lista debe existir en el servidor primero)
export async function getUnsyncedTodoItems() {
  const db = await openDB()
  return db.select(`
    SELECT ti.*, tl.server_id as list_server_id
    FROM todo_items ti
    JOIN todo_lists tl ON tl.id = ti.local_list_id
    WHERE ti.synced = 0 AND ti.pending_delete = 0 AND tl.server_id IS NOT NULL
  `)
}

export async function getPendingDeleteTodoItems() {
  const db = await openDB()
  return db.select('SELECT * FROM todo_items WHERE pending_delete = 1 AND server_id IS NOT NULL')
}

export async function markTodoItemSynced(localId, serverId) {
  const db = await openDB()
  await db.execute(
    'UPDATE todo_items SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  )
}

export async function deleteLocalTodoItem(localId) {
  const db = await openDB()
  await db.execute('DELETE FROM todo_items WHERE id = ?', [localId])
}

export async function upsertTodoItemFromServer(serverItem, localListId) {
  const db = await openDB()
  const rows = await db.select('SELECT id FROM todo_items WHERE server_id = ?', [serverItem.id])
  if (rows.length > 0) {
    await db.execute(
      'UPDATE todo_items SET title = ?, done = ?, synced = 1, pending_delete = 0 WHERE server_id = ?',
      [serverItem.title, serverItem.done ? 1 : 0, serverItem.id]
    )
  } else {
    await db.execute(
      'INSERT INTO todo_items (server_id, local_list_id, title, done, synced) VALUES (?, ?, ?, ?, 1)',
      [serverItem.id, localListId, serverItem.title, serverItem.done ? 1 : 0]
    )
  }
}
