import { useState, useEffect, useCallback } from 'react'
import './Home.css'
import './Countdowns.css'
import {
  getQuotes, getUnsyncedQuotes, getPendingDeleteQuotes,
  markQuoteSynced, upsertQuoteFromServer, purgeLocalQuote, pruneStaleQuotes,
  getCountdowns, getUnsyncedCountdowns, getPendingDeleteCountdowns,
  markCountdownSynced, upsertCountdownFromServer, purgeLocalCountdown, pruneStaleCountdowns,
} from './db/database'
import {
  isServerReachable,
  fetchAllQuotesFromServer, postQuoteToServer, putQuoteToServer, deleteQuoteFromServer,
  fetchAllCountdownsFromServer, postCountdownToServer, putCountdownToServer, deleteCountdownFromServer,
} from './api/client'
import { countdownState, countdownLabel, countdownSortKey } from './countdown'
import { useLang } from './LangContext.jsx'

let syncingHome = false

export default function Home() {
  const { t: tr, tp, locale } = useLang()
  const [current, setCurrent] = useState(null)
  const [countdowns, setCountdowns] = useState([])

  function greeting() {
    const h = new Date().getHours()
    if (h < 13) return tr('home.greetingMorning')
    if (h < 21) return tr('home.greetingAfternoon')
    return tr('home.greetingEvening')
  }

  function formatDate() {
    const d = new Date()
    const str = d.toLocaleDateString(locale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  const load = useCallback(async () => {
    const qs = await getQuotes()
    if (qs.length > 0) setCurrent(qs[Math.floor(Math.random() * qs.length)])
    setCountdowns(await getCountdowns())
  }, [])

  const sync = useCallback(async () => {
    if (syncingHome) return
    syncingHome = true
    try {
      if (!await isServerReachable()) return
      // Quotes
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

      // Countdowns
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
      const serverCountdowns = await fetchAllCountdownsFromServer()
      for (const c of serverCountdowns) await upsertCountdownFromServer(c)
      await pruneStaleCountdowns(new Set(serverCountdowns.map(c => c.id)))
    } catch (e) { console.warn('home sync failed:', e) } finally {
      syncingHome = false
      await load()
    }
  }, [load])

  useEffect(() => {
    load().then(() => sync())
  }, [])

  // Mostramos en Home los contadores próximos (futuros y de hoy), ordenados por
  // cercanía. Los pasados quedan fuera del Home; se siguen viendo en su pantalla.
  const upcoming = [...countdowns]
    .filter(c => countdownState(c.target_date, c.is_recurring).direction !== 'past')
    .sort((a, b) => countdownSortKey(a.target_date, a.is_recurring) - countdownSortKey(b.target_date, b.is_recurring))
    .slice(0, 5)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{greeting()}</h1>
        <p className="page-subtitle">{formatDate()}</p>
      </div>

      {upcoming.length > 0 && (
        <div className="home-countdowns">
          {upcoming.map(c => {
            const st = countdownState(c.target_date, c.is_recurring)
            return (
              <div key={c.id} className={`home-countdown home-countdown--${st.direction}`}>
                <span className="home-countdown-title">{c.title}</span>
                <span className="home-countdown-value">{countdownLabel(st, tr, tp)}</span>
              </div>
            )
          })}
        </div>
      )}

      {current && (
        <div className="card home-quote-card">
          <p className="home-quote-text">"{current.text}"</p>
          {current.author && <p className="home-quote-author">— {current.author}</p>}
        </div>
      )}
    </div>
  )
}
