import { useState, useEffect, useCallback } from 'react'
import './Countdowns.css'
import {
  getCountdowns, insertLocalCountdown, updateLocalCountdown,
  markCountdownSynced, markCountdownPendingDelete, purgeLocalCountdown,
  upsertCountdownFromServer, getUnsyncedCountdowns, getPendingDeleteCountdowns, pruneStaleCountdowns,
} from './db/database'
import {
  isServerReachable, fetchAllCountdownsFromServer,
  postCountdownToServer, putCountdownToServer, deleteCountdownFromServer,
} from './api/client'
import { countdownState, countdownLabel, countdownSortKey } from './countdown'
import { useLang } from './LangContext.jsx'
import { IconEdit, IconClose } from './Icons.jsx'
import DateField from './DateField.jsx'
import { useToast } from './Toast.jsx'

let syncingCountdowns = false

function todayStr() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function Countdowns() {
  const { t: tr, tp } = useLang()
  const toast = useToast()
  const [countdowns, setCountdowns] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)
  const [form, setForm] = useState({ title: '', target_date: todayStr(), is_recurring: false })
  const [editItem, setEditItem] = useState(null)

  const loadLocal = useCallback(async () => {
    setCountdowns(await getCountdowns())
  }, [])

  const sync = useCallback(async () => {
    if (syncingCountdowns) return
    syncingCountdowns = true
    try {
      if (!await isServerReachable()) return
      for (const c of await getUnsyncedCountdowns()) {
        if (c.server_id) {
          await putCountdownToServer(c.server_id, c)
          await markCountdownSynced(c.id, c.server_id)
        } else {
          const created = await postCountdownToServer(c)
          await markCountdownSynced(c.id, created.id)
        }
      }
      for (const c of await getPendingDeleteCountdowns()) {
        await deleteCountdownFromServer(c.server_id)
        await purgeLocalCountdown(c.id)
      }
      const serverItems = await fetchAllCountdownsFromServer()
      for (const c of serverItems) await upsertCountdownFromServer(c)
      await pruneStaleCountdowns(new Set(serverItems.map(c => c.id)))
    } catch (e) { console.warn('countdowns sync failed:', e) } finally {
      syncingCountdowns = false
      await loadLocal()
    }
  }, [loadLocal])

  useEffect(() => {
    async function init() {
      try {
        await loadLocal()
      } catch (e) {
        setDbError(String(e))
      } finally {
        setLoading(false)
      }
      sync()
    }
    init()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.target_date) return
    await insertLocalCountdown(form.title.trim(), form.target_date, form.is_recurring)
    setForm({ title: '', target_date: todayStr(), is_recurring: false })
    await loadLocal()
    sync()
    toast(tr('common.saved'))
  }

  async function handleDelete(item) {
    if (item.server_id) {
      await markCountdownPendingDelete(item.id)
    } else {
      await purgeLocalCountdown(item.id)
    }
    await loadLocal()
    sync()
    toast(tr('common.deleted'))
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editItem.title.trim() || !editItem.target_date) return
    await updateLocalCountdown(editItem.id, editItem.title.trim(), editItem.target_date, editItem.is_recurring)
    setEditItem(null)
    await loadLocal()
    sync()
    toast(tr('common.saved'))
  }

  const sorted = [...countdowns].sort(
    (a, b) => countdownSortKey(a.target_date, a.is_recurring) - countdownSortKey(b.target_date, b.is_recurring)
  )

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{tr('countdowns.title')}</h1>
          <p className="page-subtitle">{tr('countdowns.subtitle')}</p>
        </div>

        {dbError && (
          <div style={{ background: '#3b0000', border: '1px solid #7f1d1d', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.8rem', wordBreak: 'break-all' }}>
            <strong>Error DB:</strong> {dbError}
          </div>
        )}

        <div className="card">
          <h2 className="card-title">{tr('countdowns.addCard')}</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label>{tr('countdowns.titleLabel')}</label>
              <input
                type="text"
                placeholder={tr('countdowns.titlePh')}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{tr('countdowns.dateLabel')}</label>
              <DateField
                value={form.target_date}
                onChange={d => setForm(f => ({ ...f, target_date: d }))}
                placeholder={tr('countdowns.datePh')}
              />
            </div>
            <div className="field field--check">
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: 'var(--text-2)', fontSize: '0.8rem' }}
                onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
              >
                <button
                  type="button"
                  className={`theme-toggle ${form.is_recurring ? 'theme-toggle--on' : ''}`}
                  aria-label={tr('countdowns.recurring')}
                >
                  <span className="theme-toggle-thumb" />
                </button>
                {tr('countdowns.recurring')}
              </div>
            </div>
            <div className="field field--action">
              <button type="submit" className="btn-primary">{tr('common.add')}</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">{tr('countdowns.allCountdowns', { n: countdowns.length })}</h2>
          {loading ? (
            <p className="hint">{tr('countdowns.loading')}</p>
          ) : countdowns.length === 0 ? (
            <p className="hint">{tr('countdowns.noCountdowns')}</p>
          ) : (
            <ul className="countdown-list">
              {sorted.map(item => {
                const st = countdownState(item.target_date, item.is_recurring)
                return (
                  <li key={item.id} className={`countdown-row countdown-row--${st.direction}`}>
                    <div className="countdown-main">
                      <span className="countdown-title">{item.title}</span>
                      <span className="countdown-meta">
                        {item.target_date}
                        {item.is_recurring && <span className="countdown-tag">{tr('countdowns.recurringTag')}</span>}
                      </span>
                    </div>
                    <span className="countdown-value">{countdownLabel(st, tr, tp)}</span>
                    <span className="countdown-actions">
                      <button className="btn-icon" onClick={() => setEditItem({ ...item, is_recurring: !!item.is_recurring })} title="Edit"><IconEdit /></button>
                      <button className="btn-delete" onClick={() => handleDelete(item)}><IconClose /></button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{tr('countdowns.editCountdown')}</h3>
              <button className="btn-delete" onClick={() => setEditItem(null)}><IconClose /></button>
            </div>
            <form onSubmit={handleEdit} className="form" style={{ flexDirection: 'column' }}>
              <div className="field">
                <label>{tr('countdowns.titleLabel')}</label>
                <input
                  type="text"
                  value={editItem.title}
                  onChange={e => setEditItem(v => ({ ...v, title: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>{tr('countdowns.dateLabel')}</label>
                <DateField
                  value={editItem.target_date}
                  onChange={d => setEditItem(v => ({ ...v, target_date: d }))}
                  placeholder={tr('countdowns.datePh')}
                />
              </div>
              <div className="field">
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: 'var(--text-2)', fontSize: '0.8rem' }}
                  onClick={() => setEditItem(v => ({ ...v, is_recurring: !v.is_recurring }))}
                >
                  <button
                    type="button"
                    className={`theme-toggle ${editItem.is_recurring ? 'theme-toggle--on' : ''}`}
                    aria-label={tr('countdowns.recurring')}
                  >
                    <span className="theme-toggle-thumb" />
                  </button>
                  {tr('countdowns.recurring')}
                </div>
              </div>
              <button type="submit" className="btn-primary">{tr('common.save')}</button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Countdowns
