import { useState, useEffect, useCallback } from 'react'
import {
  getQuotes, insertLocalQuote, updateLocalQuote,
  markQuoteSynced, markQuotePendingDelete, purgeLocalQuote,
  upsertQuoteFromServer, getUnsyncedQuotes, getPendingDeleteQuotes, pruneStaleQuotes,
} from './db/database'
import {
  isServerReachable, fetchAllQuotesFromServer,
  postQuoteToServer, putQuoteToServer, deleteQuoteFromServer,
} from './api/client'
import { useLang } from './LangContext.jsx'

let syncingQuotes = false

function Quotes() {
  const { t: tr } = useLang()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)
  const [form, setForm] = useState({ text: '', author: '' })
  const [editQuote, setEditQuote] = useState(null)

  const loadLocal = useCallback(async () => {
    setQuotes(await getQuotes())
  }, [])

  const sync = useCallback(async () => {
    if (syncingQuotes) return
    syncingQuotes = true
    try {
      if (!await isServerReachable()) return
      for (const q of await getUnsyncedQuotes()) {
        if (q.server_id) {
          await putQuoteToServer(q.server_id, q)
          await markQuoteSynced(q.id, q.server_id)
        } else {
          const created = await postQuoteToServer(q)
          await markQuoteSynced(q.id, created.id)
        }
      }
      for (const q of await getPendingDeleteQuotes()) {
        await deleteQuoteFromServer(q.server_id)
        await purgeLocalQuote(q.id)
      }
      const serverQuotes = await fetchAllQuotesFromServer()
      for (const q of serverQuotes) await upsertQuoteFromServer(q)
      await pruneStaleQuotes(new Set(serverQuotes.map(q => q.id)))
    } catch {} finally {
      syncingQuotes = false
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
    await insertLocalQuote(form.text.trim(), form.author.trim() || null)
    setForm({ text: '', author: '' })
    await loadLocal()
    sync()
  }

  async function handleDelete(quote) {
    if (quote.server_id) {
      await markQuotePendingDelete(quote.id)
    } else {
      await purgeLocalQuote(quote.id)
    }
    await loadLocal()
    sync()
  }

  async function handleEdit(e) {
    e.preventDefault()
    await updateLocalQuote(editQuote.id, editQuote.text.trim(), editQuote.author?.trim() || null)
    setEditQuote(null)
    await loadLocal()
    sync()
  }

  return (
    <>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{tr('quotes.title')}</h1>
          <p className="page-subtitle">{tr('quotes.subtitle')}</p>
        </div>

        {dbError && (
          <div style={{ background: '#3b0000', border: '1px solid #7f1d1d', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.8rem', wordBreak: 'break-all' }}>
            <strong>Error DB:</strong> {dbError}
          </div>
        )}

        <div className="card">
          <h2 className="card-title">{tr('quotes.addCard')}</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label>{tr('quotes.quoteLabel')}</label>
              <input
                type="text"
                placeholder={tr('quotes.introQuotePh')}
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{tr('quotes.authorLabel')}</label>
              <input
                type="text"
                placeholder={tr('quotes.authorExPh')}
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
              />
            </div>
            <div className="field field--action">
              <button type="submit" className="btn-primary">{tr('quotes.add')}</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">{tr('quotes.allQuotes', { n: quotes.length })}</h2>
          {loading ? (
            <p className="hint">{tr('quotes.loading')}</p>
          ) : quotes.length === 0 ? (
            <p className="hint">{tr('quotes.noQuotes')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{tr('quotes.quoteLabel')}</th>
                  <th>{tr('quotes.authorLabel')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(quote => (
                  <tr key={quote.id}>
                    <td>"{quote.text}"</td>
                    <td className="note-cell">{quote.author ?? '—'}</td>
                    <td>
                      <button className="btn-icon" onClick={() => setEditQuote({ ...quote })} title="Edit">✎</button>
                      <button className="btn-delete" onClick={() => handleDelete(quote)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editQuote && (
        <div className="modal-overlay" onClick={() => setEditQuote(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{tr('quotes.editQuote')}</h3>
              <button className="btn-delete" onClick={() => setEditQuote(null)}>×</button>
            </div>
            <form onSubmit={handleEdit} className="form" style={{ flexDirection: 'column' }}>
              <div className="field">
                <label>{tr('quotes.quoteLabel')}</label>
                <input
                  type="text"
                  value={editQuote.text}
                  onChange={e => setEditQuote(v => ({ ...v, text: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>{tr('quotes.authorLabel')}</label>
                <input
                  type="text"
                  value={editQuote.author ?? ''}
                  onChange={e => setEditQuote(v => ({ ...v, author: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary">{tr('common.save')}</button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Quotes
