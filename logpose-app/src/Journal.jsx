import { useState, useEffect, useCallback } from 'react'
import {
  getTodayJournalEntry, getAllJournalEntries, saveJournalEntry, getJournalStreak,
  getUnsyncedJournalEntries, getPendingDeleteJournalEntries,
  markJournalEntrySynced, purgeLocalJournalEntry, upsertJournalEntryFromServer, pruneStaleJournalEntries,
} from './db/database'
import {
  isServerReachable,
  fetchAllJournalEntriesFromServer, postJournalEntryToServer, putJournalEntryToServer, deleteJournalEntryFromServer,
} from './api/client'
import { useLang } from './LangContext.jsx'

const TODAY = new Date().toISOString().slice(0, 10)

let syncingJournal = false

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function Journal() {
  const { t: tr, tp, locale } = useLang()
  const [view, setView] = useState('today')
  const [entry, setEntry] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [streak, setStreak] = useState(0)
  const [history, setHistory] = useState([])

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-')
    const str = new Date(+y, +m - 1, +d).toLocaleDateString(locale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  const loadToday = useCallback(async () => {
    const e = await getTodayJournalEntry()
    setEntry(e)
    setDraft(e?.content ?? '')
  }, [])

  const loadStreak = useCallback(async () => {
    setStreak(await getJournalStreak())
  }, [])

  const syncJournal = useCallback(async () => {
    if (syncingJournal) return
    syncingJournal = true
    try {
      if (!await isServerReachable()) return
      for (const e of await getPendingDeleteJournalEntries()) {
        try { await deleteJournalEntryFromServer(e.server_id) } catch {}
        await purgeLocalJournalEntry(e.id)
      }
      for (const e of await getUnsyncedJournalEntries()) {
        try {
          if (e.server_id) {
            await putJournalEntryToServer(e.server_id, e)
            await markJournalEntrySynced(e.id, e.server_id)
          } else {
            const created = await postJournalEntryToServer(e)
            await markJournalEntrySynced(e.id, created.id)
          }
        } catch {}
      }
      const serverEntries = await fetchAllJournalEntriesFromServer()
      for (const e of serverEntries) await upsertJournalEntryFromServer(e)
      await pruneStaleJournalEntries(new Set(serverEntries.map(e => e.id)))
    } catch {} finally {
      syncingJournal = false
      await loadToday()
      await loadStreak()
    }
  }, [loadToday, loadStreak])

  useEffect(() => {
    loadToday().then(() => { loadStreak(); syncJournal() })
  }, [])

  async function handleSave() {
    if (!draft.trim()) return
    setSaving(true)
    await saveJournalEntry(draft)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await loadToday()
    await loadStreak()
    syncJournal()
  }

  async function openHistory() {
    const all = await getAllJournalEntries()
    setHistory(all.filter(e => e.date !== TODAY))
    setView('history')
  }

  if (view === 'history') {
    return (
      <div className="page">
        <div className="page-header">
          <button
            onClick={() => setView('today')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '0.75rem' }}
          >
            {tr('journal.back')}
          </button>
          <h1 className="page-title">{tr('journal.historyTitle')}</h1>
        </div>

        {history.length === 0 ? (
          <p className="hint">{tr('journal.noHistory')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 640 }}>
            {history.map(e => (
              <div key={e.id} className="card" style={{ padding: '1.25rem' }}>
                <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', textTransform: 'capitalize', marginBottom: '0.6rem' }}>
                  {formatDate(e.date)}
                </p>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {e.content || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>{tr('journal.noContent')}</span>}
                </p>
                <p style={{ color: 'var(--text-3)', fontSize: '0.72rem', marginTop: '0.75rem' }}>
                  {tp('journal.wordCount', wordCount(e.content))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const words = wordCount(draft)

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="page-title">{tr('journal.title')}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {streak > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', background: 'var(--surface-2)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-2)' }}>
                {tp('journal.streak', streak)}
              </span>
            )}
            <button
              className="btn-cancel"
              style={{ fontSize: '0.8rem' }}
              onClick={openHistory}
            >
              {tr('journal.historyBtn')}
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: '0.4rem', textTransform: 'capitalize' }}>
          {formatDate(TODAY)}
        </p>
      </div>

      <div style={{ maxWidth: 640 }}>
        <textarea
          className="journal-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={tr('journal.placeholder')}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>
            {tp('journal.wordCount', words)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saved && <span style={{ color: '#22c55e', fontSize: '0.78rem' }}>{tr('journal.saved')}</span>}
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
            >
              {saving ? tr('journal.saving') : tr('journal.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
