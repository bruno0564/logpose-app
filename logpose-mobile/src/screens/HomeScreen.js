import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, StyleSheet, ScrollView } from 'react-native'
import Text from '../components/Text'
import CartoonCard from '../components/CartoonCard'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'
import {
  getQuotes, getUnsyncedQuotes, getPendingDeleteQuotes,
  markQuoteSynced, upsertQuoteFromServer, purgeLocalQuote, pruneStaleQuotes,
  getCountdowns, getUnsyncedCountdowns, getPendingDeleteCountdowns,
  markCountdownSynced, upsertCountdownFromServer, purgeLocalCountdown, pruneStaleCountdowns,
  getCalendarEvents,
} from '../db/database'
import { eventsForDate, toDateStr, dowOf } from '../calendar'
import {
  isServerReachable,
  fetchAllQuotesFromServer, postQuoteToServer, putQuoteToServer, deleteQuoteFromServer,
  fetchAllCountdownsFromServer, postCountdownToServer, putCountdownToServer, deleteCountdownFromServer,
} from '../api/client'
import { countdownState, countdownLabel, countdownSortKey } from '../countdown'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

let syncingHome = false

export default function HomeScreen() {
  const { theme: t } = useTheme()
  const { t: tr, tp, locale } = useLang()
  const s = makeStyles(t)
  const [current, setCurrent] = useState(null)
  const [countdowns, setCountdowns] = useState([])
  const [events, setEvents] = useState([])

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
    setEvents(await getCalendarEvents())
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

  const upcoming = [...countdowns]
    .filter(c => countdownState(c.target_date, c.is_recurring).direction !== 'past')
    .sort((a, b) => countdownSortKey(a.target_date, a.is_recurring) - countdownSortKey(b.target_date, b.is_recurring))
    .slice(0, 5)

  const now = new Date()
  const todayEvents = eventsForDate(events, toDateStr(now), dowOf(now))

  useFocusEffect(
    useCallback(() => {
      load().then(() => sync())
    }, [load, sync])
  )

  return (
    <FadeInView style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.header}>
          <Text style={s.greeting}>{greeting()}</Text>
          <Text style={s.date}>{formatDate()}</Text>
        </View>

        {todayEvents.length > 0 && (
          <View style={s.todaySection}>
            <Text style={s.sectionTitle}>{tr('home.todayEvents')}</Text>
            {todayEvents.map(ev => (
              <CartoonCard key={ev.id} style={s.eventCard} radius={12}>
                <View style={[s.eventBar, { backgroundColor: ev.color || '#7c3aed' }]} />
                <Text style={s.eventTime}>{ev.start_time || '—'}</Text>
                <Text style={s.eventTitle} numberOfLines={1}>{ev.title}</Text>
              </CartoonCard>
            ))}
          </View>
        )}

        {upcoming.length > 0 && (
          <View style={s.countdowns}>
            {upcoming.map(c => {
              const st = countdownState(c.target_date, c.is_recurring)
              const valueColor = st.direction === 'today' ? t.success : t.accent
              return (
                <CartoonCard key={c.id} style={s.countdownCard} radius={t.cartoon ? 12 : 12}>
                  <Text style={s.countdownTitle} numberOfLines={1}>{c.title}</Text>
                  <Text style={[s.countdownValue, { color: valueColor }]}>{countdownLabel(st, tr, tp)}</Text>
                </CartoonCard>
              )
            })}
          </View>
        )}

        {current && (
          <CartoonCard style={s.quoteCard} radius={t.cartoon ? 14 : 16}>
            <Text style={s.quoteText}>"{current.text}"</Text>
            {current.author && <Text style={s.quoteAuthor}>— {current.author}</Text>}
          </CartoonCard>
        )}
      </ScrollView>
    </FadeInView>
  )
}

const makeStyles = (t) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: t.bg },
  content:     { padding: 20, paddingTop: 20, paddingBottom: 40 },
  header:      { marginBottom: 28 },
  greeting:    { color: t.cartoon ? t.accent : t.text, fontSize: 28, fontWeight: '700', letterSpacing: t.cartoon ? 0.5 : -0.5, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
  date:        { color: t.text3, fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  todaySection: { marginBottom: 20, gap: 8 },
  sectionTitle: { color: t.text3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  eventCard:   { backgroundColor: t.surface, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventBar:    { width: 4, height: 26, borderRadius: 2 },
  eventTime:   { color: t.text3, fontSize: 13, fontWeight: '600', width: 44, fontVariant: ['tabular-nums'] },
  eventTitle:  { color: t.text, fontSize: 14, flex: 1 },
  countdowns:  { gap: 8, marginBottom: 20 },
  countdownCard: { backgroundColor: t.surface, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  countdownTitle: { color: t.text2, fontSize: 14, flex: 1 },
  countdownValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  quoteCard:   { backgroundColor: t.surface, padding: 24 },
  quoteText:   { color: t.text, fontSize: 17, fontStyle: t.cartoon ? 'normal' : 'italic', lineHeight: 28 },
  quoteAuthor: { color: t.text3, fontSize: 12, marginTop: 12, textAlign: 'right' },
})
