import { useState, useEffect, useCallback } from 'react'
import {
  getHabitCategories, insertHabitCategory, updateHabitCategory, deleteLocalHabitCategory,
  getHabits, insertHabit, updateHabit, deleteLocalHabit,
  getHabitLogs, toggleHabitLog,
  getUnsyncedHabitCategories, getPendingDeleteHabitCategories, markHabitCategorySynced, purgeLocalHabitCategory, upsertHabitCategoryFromServer, pruneStaleHabitCategories,
  getUnsyncedHabits, getPendingDeleteHabits, markHabitSynced, purgeLocalHabit, upsertHabitFromServer, pruneStaleHabits,
  getUnsyncedHabitLogs, getPendingDeleteHabitLogs, markHabitLogSynced, purgeLocalHabitLog, upsertHabitLogFromServer, pruneStaleHabitLogs,
} from './db/database'
import {
  isServerReachable,
  fetchAllHabitCategoriesFromServer, postHabitCategoryToServer, putHabitCategoryToServer, deleteHabitCategoryFromServer,
  fetchAllHabitsFromServer, postHabitToServer, putHabitToServer, deleteHabitFromServer,
  fetchHabitLogsFromServer, postHabitLogToServer, deleteHabitLogFromServer,
} from './api/client'
import { IconClose } from './Icons.jsx'

let syncingHabits = false

const CATEGORY_COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#ea580c', '#dc2626', '#0891b2', '#d97706']

function toMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function Habits() {
  const now        = new Date()
  const [cursor, setCursor]         = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [categories, setCategories] = useState([])
  const [habits, setHabits]         = useState([])
  const [logs, setLogs]             = useState([])
  const [activeCatId, setActiveCatId] = useState(null)
  const [modal, setModal]           = useState(null) // {type:'cat'|'habit', mode:'create'|'edit', data?}
  const [form, setForm]             = useState({})

  const monthStr = toMonthStr(cursor)
  const year     = cursor.getFullYear()
  const month    = cursor.getMonth()
  const days     = daysInMonth(year, month)
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate())

  const load = useCallback(async () => {
    const [cats, habs, ls] = await Promise.all([
      getHabitCategories(),
      getHabits(),
      getHabitLogs(monthStr),
    ])
    setCategories(cats)
    setHabits(habs)
    setLogs(ls)
    if (cats.length > 0) setActiveCatId(id => id ?? cats[0].id)
  }, [monthStr])

  const sync = useCallback(async () => {
    if (syncingHabits) return
    syncingHabits = true
    try {
      if (!await isServerReachable()) return

      // 1. categories
      for (const c of await getUnsyncedHabitCategories()) {
        if (c.server_id) { await putHabitCategoryToServer(c.server_id, c); await markHabitCategorySynced(c.id, c.server_id) }
        else             { const r = await postHabitCategoryToServer(c); await markHabitCategorySynced(c.id, r.id) }
      }
      for (const c of await getPendingDeleteHabitCategories()) {
        await deleteHabitCategoryFromServer(c.server_id); await purgeLocalHabitCategory(c.id)
      }

      // 2. habits
      for (const h of await getUnsyncedHabits()) {
        if (h.server_id) { await putHabitToServer(h.server_id, h); await markHabitSynced(h.id, h.server_id) }
        else             { const r = await postHabitToServer(h, h.cat_server_id); await markHabitSynced(h.id, r.id) }
      }
      for (const h of await getPendingDeleteHabits()) {
        await deleteHabitFromServer(h.server_id); await purgeLocalHabit(h.id)
      }

      // 3. logs
      for (const l of await getUnsyncedHabitLogs()) {
        if (l.server_id) { /* logs are immutable once created */ await markHabitLogSynced(l.id, l.server_id) }
        else             { const r = await postHabitLogToServer(l, l.habit_server_id); await markHabitLogSynced(l.id, r.id) }
      }
      for (const l of await getPendingDeleteHabitLogs()) {
        await deleteHabitLogFromServer(l.server_id); await purgeLocalHabitLog(l.id)
      }

      // pull from server
      const serverCats  = await fetchAllHabitCategoriesFromServer()
      const serverHabits = await fetchAllHabitsFromServer()
      const serverLogs  = await fetchHabitLogsFromServer(monthStr)

      for (const c of serverCats) await upsertHabitCategoryFromServer(c)
      await pruneStaleHabitCategories(new Set(serverCats.map(c => c.id)))

      const localCats = await getHabitCategories()
      const serverIdToLocalId = Object.fromEntries(localCats.filter(c => c.server_id).map(c => [c.server_id, c.id]))
      for (const h of serverHabits) {
        const localCatId = serverIdToLocalId[h.category_id]
        if (localCatId) await upsertHabitFromServer(h, localCatId)
      }
      await pruneStaleHabits(new Set(serverHabits.map(h => h.id)))

      const localHabits = await getHabits()
      const habitServerIdToLocalId = Object.fromEntries(localHabits.filter(h => h.server_id).map(h => [h.server_id, h.id]))
      for (const l of serverLogs) {
        const localHabitId = habitServerIdToLocalId[l.habit_id]
        if (localHabitId) await upsertHabitLogFromServer(l, localHabitId)
      }
      await pruneStaleHabitLogs(new Set(serverLogs.map(l => l.id)))
    } catch {}
    finally {
      syncingHabits = false
      await load()
    }
  }, [load, monthStr])

  useEffect(() => { load().then(() => sync()) }, [monthStr])

  async function handleToggle(habitId, day) {
    await toggleHabitLog(habitId, toDateStr(year, month, day))
    await load()
    sync()
  }

  // ── Category modal ────────────────────────────────────────────────────────

  function openCreateCat() {
    setForm({ name: '', color: CATEGORY_COLORS[0] })
    setModal({ type: 'cat', mode: 'create' })
  }
  function openEditCat(cat) {
    setForm({ name: cat.name, color: cat.color })
    setModal({ type: 'cat', mode: 'edit', data: cat })
  }
  async function handleSaveCat(e) {
    e.preventDefault()
    if (modal.mode === 'create') {
      await insertHabitCategory({ name: form.name.trim(), color: form.color })
    } else {
      await updateHabitCategory(modal.data.id, { name: form.name.trim(), color: form.color })
    }
    setModal(null)
    await load()
    sync()
  }
  async function handleDeleteCat() {
    await deleteLocalHabitCategory(modal.data.id)
    setActiveCatId(null)
    setModal(null)
    await load()
    sync()
  }

  // ── Habit modal ───────────────────────────────────────────────────────────

  function openCreateHabit() {
    setForm({ name: '', goal: 30 })
    setModal({ type: 'habit', mode: 'create' })
  }
  function openEditHabit(habit) {
    setForm({ name: habit.name, goal: habit.goal })
    setModal({ type: 'habit', mode: 'edit', data: habit })
  }
  async function handleSaveHabit(e) {
    e.preventDefault()
    if (modal.mode === 'create') {
      const catHabits = habits.filter(h => h.local_category_id === activeCatId)
      await insertHabit({ local_category_id: activeCatId, name: form.name.trim(), goal: Number(form.goal), position: catHabits.length })
    } else {
      await updateHabit(modal.data.id, { name: form.name.trim(), goal: Number(form.goal), position: modal.data.position })
    }
    setModal(null)
    await load()
    sync()
  }
  async function handleDeleteHabit() {
    await deleteLocalHabit(modal.data.id)
    setModal(null)
    await load()
    sync()
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const activeCat    = categories.find(c => c.id === activeCatId)
  const visibleHabits = habits.filter(h => h.local_category_id === activeCatId)
  const logSet       = new Set(logs.filter(l => !l.pending_delete).map(l => `${l.local_habit_id}-${l.date}`))

  function isDone(habitId, day) {
    return logSet.has(`${habitId}-${toDateStr(year, month, day)}`)
  }
  function completedDays(habitId) {
    return logs.filter(l => l.local_habit_id === habitId && !l.pending_delete).length
  }
  function pct(habitId, goal) {
    return Math.round((completedDays(habitId) / (goal || 30)) * 100)
  }
  function overallPct() {
    if (visibleHabits.length === 0) return 0
    const total = visibleHabits.reduce((acc, h) => acc + pct(h.id, h.goal), 0)
    return Math.round(total / visibleHabits.length)
  }

  const rate = overallPct()
  const rateLabel = rate >= 80 ? 'ON FIRE 🔥' : rate >= 50 ? 'KEEP GOING' : rate > 0 ? 'NEEDS WORK' : '—'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="page habits-page">
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 className="page-title">Habits</h1>
            <button className="btn-primary" onClick={openCreateCat}>+ Category</button>
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="habits-cat-tabs">
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`habits-cat-tab${activeCatId === cat.id ? ' habits-cat-tab--active' : ''}`}
                style={activeCatId === cat.id ? { borderBottomColor: cat.color, color: cat.color } : {}}
                onClick={() => setActiveCatId(cat.id)}
              >
                <span className="habits-cat-dot" style={{ background: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Month nav + category actions */}
        {activeCat && (
          <div className="habits-month-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="cal-arrow" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
              <span className="habits-month-label">
                {cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
              </span>
              <button className="cal-arrow" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`habits-rate ${rate >= 80 ? 'habits-rate--good' : rate >= 50 ? 'habits-rate--mid' : 'habits-rate--bad'}`}>
                {rate}% — {rateLabel}
              </span>
              <button className="btn-icon" title="Edit category" onClick={() => openEditCat(activeCat)}>✎</button>
              <button className="btn-primary" style={{ fontSize: '0.78rem' }} onClick={openCreateHabit}>+ Habit</button>
            </div>
          </div>
        )}

        {/* Grid */}
        {activeCat && visibleHabits.length === 0 && (
          <p className="hint" style={{ marginTop: '2rem' }}>No habits yet — add one above.</p>
        )}

        {activeCat && visibleHabits.length > 0 && (
          <div className="habits-grid-wrap">
            <table className="habits-grid">
              <thead>
                <tr>
                  <th className="habits-grid-label-col">Habit</th>
                  {Array.from({ length: days }, (_, i) => {
                    const ds  = toDateStr(year, month, i + 1)
                    const dow = new Date(year, month, i + 1).toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 1).toUpperCase()
                    return (
                      <th key={i} className={`habits-grid-day-th${ds === todayStr ? ' habits-grid-day-th--today' : ''}`}>
                        <div>{i + 1}</div>
                        <div className="habits-grid-dow">{dow}</div>
                      </th>
                    )
                  })}
                  <th className="habits-grid-pct-col">%</th>
                  <th className="habits-grid-pct-col">/{days}</th>
                </tr>
              </thead>
              <tbody>
                {visibleHabits.map(habit => (
                  <tr key={habit.id}>
                    <td className="habits-grid-habit-name" onDoubleClick={() => openEditHabit(habit)} title="Double-click to edit">
                      {habit.name}
                      <span className="habits-grid-goal"> /{habit.goal}</span>
                    </td>
                    {Array.from({ length: days }, (_, i) => {
                      const done = isDone(habit.id, i + 1)
                      const ds   = toDateStr(year, month, i + 1)
                      return (
                        <td key={i} className={`habits-grid-cell${done ? ' habits-grid-cell--done' : ''}${ds === todayStr ? ' habits-grid-cell--today' : ''}`}
                          onClick={() => handleToggle(habit.id, i + 1)}>
                          {done && <span className="habits-check">✓</span>}
                        </td>
                      )
                    })}
                    <td className="habits-grid-pct">{pct(habit.id, habit.goal)}%</td>
                    <td className="habits-grid-pct">{completedDays(habit.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {categories.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-4)' }}>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No categories yet.</p>
            <p style={{ fontSize: '0.85rem' }}>Create a category to get started.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'cat' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'create' ? 'New category' : 'Edit category'}</h3>
              <button className="btn-delete" onClick={() => setModal(null)}><IconClose /></button>
            </div>
            <form onSubmit={handleSaveCat} className="form" style={{ flexDirection: 'column', gap: '0.85rem' }}>
              <div className="field">
                <label>Name</label>
                <input type="text" required autoFocus value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label>Color</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {CATEGORY_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: form.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', outline: form.color === c ? `2px solid ${c}` : 'none', boxSizing: 'border-box' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {modal.mode === 'edit'
                  ? <button type="button" className="btn-delete" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={handleDeleteCat}>Delete</button>
                  : <span />}
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'habit' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'create' ? 'New habit' : 'Edit habit'}</h3>
              <button className="btn-delete" onClick={() => setModal(null)}><IconClose /></button>
            </div>
            <form onSubmit={handleSaveHabit} className="form" style={{ flexDirection: 'column', gap: '0.85rem' }}>
              <div className="field">
                <label>Habit name</label>
                <input type="text" required autoFocus value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label>Goal (days this month)</label>
                <input type="number" min="1" max="31" required value={form.goal}
                  onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} style={{ maxWidth: 80 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {modal.mode === 'edit'
                  ? <button type="button" className="btn-delete" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={handleDeleteHabit}>Delete</button>
                  : <span />}
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
