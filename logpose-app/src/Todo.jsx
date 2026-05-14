import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getTodoLists, insertTodoList, deleteTodoList,
  getTodoItems, insertTodoItem, toggleTodoItem, deleteTodoItem,
  getUnsyncedTodoLists, getPendingDeleteTodoLists, markTodoListSynced, deleteLocalTodoList,
  getUnsyncedTodoItems, getPendingDeleteTodoItems, markTodoItemSynced, deleteLocalTodoItem,
  upsertTodoListFromServer, upsertTodoItemFromServer,
} from './db/database'
import {
  isServerReachable,
  fetchAllTodoListsFromServer, postTodoListToServer, deleteTodoListFromServer,
  fetchTodoItemsFromServer, postTodoItemToServer, putTodoItemToServer, deleteTodoItemFromServer,
} from './api/client'

export default function Todo() {
  const [lists, setLists] = useState([])
  const [activeList, setActiveList] = useState(null)
  const activeListRef = useRef(null)
  const [items, setItems] = useState([])
  const [newListName, setNewListName] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')

  const loadLists = useCallback(async () => {
    const rows = await getTodoLists()
    setLists(rows)
    return rows
  }, [])

  useEffect(() => { activeListRef.current = activeList }, [activeList])

  const loadItems = useCallback(async (localListId) => {
    setItems(await getTodoItems(localListId))
  }, [])

  const sync = useCallback(async () => {
    try {
      if (!await isServerReachable()) return
      for (const lst of await getUnsyncedTodoLists()) {
        const created = await postTodoListToServer(lst.name)
        await markTodoListSynced(lst.id, created.id)
      }
      for (const item of await getUnsyncedTodoItems()) {
        if (item.server_id) {
          await putTodoItemToServer(item.server_id, item.title, item.done === 1)
        } else {
          const created = await postTodoItemToServer(item.list_server_id, item.title, item.done === 1)
          await markTodoItemSynced(item.id, created.id)
        }
      }
      for (const item of await getPendingDeleteTodoItems()) {
        await deleteTodoItemFromServer(item.server_id)
        await deleteLocalTodoItem(item.id)
      }
      for (const lst of await getPendingDeleteTodoLists()) {
        await deleteTodoListFromServer(lst.server_id)
        await deleteLocalTodoList(lst.id)
      }
      const serverLists = await fetchAllTodoListsFromServer()
      for (const serverList of serverLists) {
        const localListId = await upsertTodoListFromServer(serverList)
        for (const serverItem of await fetchTodoItemsFromServer(serverList.id)) {
          await upsertTodoItemFromServer(serverItem, localListId)
        }
      }
    } catch { /* sin conexión */ } finally {
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
    const localId = await insertTodoList(newListName.trim())
    setNewListName('')
    setAddingList(false)
    const rows = await loadLists()
    setActiveList(rows.find(l => l.id === localId) ?? rows[0])
    sync()
  }

  async function handleDeleteList(list) {
    if (!confirm(`¿Eliminar la lista "${list.name}" y todas sus tareas?`)) return
    await deleteTodoList(list.id)
    const updated = await loadLists()
    setActiveList(updated.length > 0 ? updated[0] : null)
    sync()
  }

  async function handleAddItem(e) {
    e.preventDefault()
    if (!newItemTitle.trim() || !activeList) return
    await insertTodoItem(activeList.id, newItemTitle.trim())
    setNewItemTitle('')
    await loadItems(activeList.id)
    sync()
  }

  async function handleToggle(item) {
    await toggleTodoItem(item.id, item.done === 0)
    await loadItems(activeList.id)
    sync()
  }

  async function handleDeleteItem(item) {
    await deleteTodoItem(item.id)
    await loadItems(activeList.id)
    sync()
  }

  const pending = items.filter(i => i.done === 0)
  const done = items.filter(i => i.done === 1)

  return (
    <div className="page">
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
