import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getTaskLists, insertTaskList, deleteTaskList,
  getTaskItems, insertTaskItem, toggleTaskItem, deleteTaskItem,
  getUnsyncedTaskLists, getPendingDeleteTaskLists, markTaskListSynced, deleteLocalTaskList,
  getUnsyncedTaskItems, getPendingDeleteTaskItems, markTaskItemSynced, deleteLocalTaskItem,
  upsertTaskListFromServer, upsertTaskItemFromServer,
  pruneStaleTaskLists, pruneStaleTaskItemsForList,
} from './db/database'
import {
  isServerReachable,
  fetchAllTaskListsFromServer, postTaskListToServer, deleteTaskListFromServer,
  fetchTaskItemsFromServer, postTaskItemToServer, putTaskItemToServer, deleteTaskItemFromServer,
} from './api/client'

let syncingTasks = false

export default function Tasks() {
  const [lists, setLists] = useState([])
  const [activeList, setActiveList] = useState(null)
  const activeListRef = useRef(null)
  const [items, setItems] = useState([])
  const [newListName, setNewListName] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [newItemTitle, setNewItemTitle] = useState('')

  const loadLists = useCallback(async () => {
    const rows = await getTaskLists()
    setLists(rows)
    return rows
  }, [])

  useEffect(() => { activeListRef.current = activeList }, [activeList])

  const loadItems = useCallback(async (localListId) => {
    setItems(await getTaskItems(localListId))
  }, [])

  const sync = useCallback(async () => {
    if (syncingTasks) return
    syncingTasks = true
    try {
      if (!await isServerReachable()) return
      for (const lst of await getUnsyncedTaskLists()) {
        const created = await postTaskListToServer(lst.name)
        await markTaskListSynced(lst.id, created.id)
      }
      for (const item of await getUnsyncedTaskItems()) {
        if (item.server_id) {
          await putTaskItemToServer(item.server_id, item.title, item.done === 1)
        } else {
          const created = await postTaskItemToServer(item.list_server_id, item.title, item.done === 1)
          await markTaskItemSynced(item.id, created.id)
        }
      }
      for (const item of await getPendingDeleteTaskItems()) {
        await deleteTaskItemFromServer(item.server_id)
        await deleteLocalTaskItem(item.id)
      }
      for (const lst of await getPendingDeleteTaskLists()) {
        await deleteTaskListFromServer(lst.server_id)
        await deleteLocalTaskList(lst.id)
      }
      const serverLists = await fetchAllTaskListsFromServer()
      for (const serverList of serverLists) {
        const localListId = await upsertTaskListFromServer(serverList)
        const serverItems = await fetchTaskItemsFromServer(serverList.id)
        for (const serverItem of serverItems) {
          await upsertTaskItemFromServer(serverItem, localListId)
        }
        await pruneStaleTaskItemsForList(localListId, new Set(serverItems.map(i => i.id)))
      }
      await pruneStaleTaskLists(new Set(serverLists.map(l => l.id)))
    } catch {} finally {
      syncingTasks = false
      await loadLists()
      if (activeListRef.current) await loadItems(activeListRef.current.id)
    }
  }, [loadLists, loadItems])

  useEffect(() => {
    async function init() {
      const rows = await loadLists()
      if (rows.length > 0) setActiveList(rows[0])
      sync()
    }
    init()
  }, [])

  useEffect(() => {
    if (activeList) loadItems(activeList.id)
    else setItems([])
  }, [activeList])

  async function handleAddList(e) {
    e.preventDefault()
    if (!newListName.trim()) return
    const localId = await insertTaskList(newListName.trim())
    setNewListName('')
    setAddingList(false)
    const rows = await loadLists()
    setActiveList(rows.find(l => l.id === localId) ?? rows[0])
    sync()
  }

  function handleDeleteList(list) {
    setConfirmTarget(list)
  }

  async function confirmDeleteList() {
    const list = confirmTarget
    setConfirmTarget(null)
    await deleteTaskList(list.id)
    const updated = await loadLists()
    setActiveList(updated.length > 0 ? updated[0] : null)
    sync()
  }

  async function handleAddItem(e) {
    e.preventDefault()
    if (!newItemTitle.trim() || !activeList) return
    await insertTaskItem(activeList.id, newItemTitle.trim())
    setNewItemTitle('')
    await loadItems(activeList.id)
    sync()
  }

  async function handleToggle(item) {
    await toggleTaskItem(item.id, item.done === 0)
    await loadItems(activeList.id)
    sync()
  }

  async function handleDeleteItem(item) {
    await deleteTaskItem(item.id)
    await loadItems(activeList.id)
    sync()
  }

  const pending = items.filter(i => i.done === 0)
  const done = items.filter(i => i.done === 1)

  return (
    <div className="page">
      {confirmTarget && (
        <div className="modal-overlay" onClick={() => setConfirmTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirmar</h3>
              <button className="modal-close" onClick={() => setConfirmTarget(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              ¿Eliminar la lista "{confirmTarget.name}" y todas sus tareas?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setConfirmTarget(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmDeleteList}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      <div className="page-header">
        <h1 className="page-title">To-Do</h1>
        <p className="page-subtitle">Listas de tareas</p>
      </div>

      <div className="todo-layout">
        <div className="todo-sidebar">
          <div className="card" style={{ marginBottom: 0, padding: '1.25rem' }}>
            <h2 className="card-title">Listas</h2>

            {lists.map(list => (
              <div
                key={list.id}
                className={`todo-list-row ${activeList?.id === list.id ? 'todo-list-row--active' : ''}`}
                onClick={() => setActiveList(list)}
              >
                <span className="todo-list-name">{list.name}</span>
                <button className="btn-delete"
                  onClick={e => { e.stopPropagation(); handleDeleteList(list) }}>×</button>
              </div>
            ))}

            {addingList ? (
              <form onSubmit={handleAddList} className="todo-new-list">
                <input autoFocus type="text" placeholder="Nombre de la lista"
                  value={newListName} onChange={e => setNewListName(e.target.value)} />
                <div className="todo-new-list-actions">
                  <button type="submit" className="btn-primary">Crear</button>
                  <button type="button" className="btn-cancel"
                    onClick={() => { setAddingList(false); setNewListName('') }}>Cancelar</button>
                </div>
              </form>
            ) : (
              <button className="btn-primary todo-add-list-btn" onClick={() => setAddingList(true)}>
                + Nueva lista
              </button>
            )}
          </div>
        </div>

        <div className="todo-content">
          {!activeList ? (
            lists.length === 0
              ? <p className="hint">Crea una lista para empezar.</p>
              : <p className="hint">Selecciona una lista.</p>
          ) : (
            <div className="card" style={{ marginBottom: 0 }}>
              <h2 className="card-title" style={{ marginBottom: '1rem' }}>{activeList.name}</h2>

              <form onSubmit={handleAddItem} className="todo-add-item">
                <input type="text" placeholder="Nueva tarea..." value={newItemTitle}
                  onChange={e => setNewItemTitle(e.target.value)} />
                <button type="submit" className="btn-primary">Añadir</button>
              </form>

              {items.length === 0 ? (
                <p className="hint">Sin tareas todavía.</p>
              ) : (
                <>
                  {pending.map(item => (
                    <div key={item.id} className="todo-item">
                      <button className="todo-check" onClick={() => handleToggle(item)} />
                      <span className="todo-item-title">{item.title}</span>
                      <button className="btn-delete" onClick={() => handleDeleteItem(item)}>×</button>
                    </div>
                  ))}
                  {done.length > 0 && (
                    <>
                      <p className="todo-done-label">Completadas</p>
                      {done.map(item => (
                        <div key={item.id} className="todo-item todo-item--done">
                          <button className="todo-check todo-check--done" onClick={() => handleToggle(item)}>✓</button>
                          <span className="todo-item-title">{item.title}</span>
                          <button className="btn-delete" onClick={() => handleDeleteItem(item)}>×</button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
