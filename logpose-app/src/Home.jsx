import { useState, useEffect, useCallback } from 'react'
import './Home.css'
import {
  getQuotes, getUnsyncedQuotes, getPendingDeleteQuotes,
  markQuoteSynced, upsertQuoteFromServer, deleteLocalQuote,
} from './db/database'
import {
  isServerReachable,
  fetchAllQuotesFromServer, postQuoteToServer, deleteQuoteFromServer,
} from './api/client'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function greeting() {
  const h = new Date().getHours()
  if (h < 13) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatDate() {
  const d = new Date()
  return `${DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
}

export default function Home() {
  const [current, setCurrent] = useState(null)

  const load = useCallback(async () => {
    const qs = await getQuotes()
    if (qs.length > 0) setCurrent(qs[Math.floor(Math.random() * qs.length)])
  }, [])

  const sync = useCallback(async () => {
    try {
      if (!await isServerReachable()) return
      for (const q of await getUnsyncedQuotes()) {
        const created = await postQuoteToServer(q)
        await markQuoteSynced(q.id, created.id)
      }
      for (const q of await getPendingDeleteQuotes()) {
        await deleteQuoteFromServer(q.server_id)
        await deleteLocalQuote(q.id)
      }
      for (const q of await fetchAllQuotesFromServer()) {
        await upsertQuoteFromServer(q)
      }
    } catch { /* sin conexión */ } finally {
      await load()
    }
  }, [load])

  useEffect(() => {
    load().then(() => sync())
  }, [])

  return (
    <div className="home-page">
      <div className="home-header">
        <h1 className="home-greeting">{greeting()}</h1>
        <p className="home-date">{formatDate()}</p>
      </div>

      {current && (
        <div className="home-quote-card">
          <p className="home-quote-text">"{current.text}"</p>
          {current.author && <p className="home-quote-author">— {current.author}</p>}
        </div>
      )}
    </div>
  )
}
