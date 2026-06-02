import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import FadeInView from '../components/FadeInView'
import {
  getQuotes, getUnsyncedQuotes, getPendingDeleteQuotes,
  markQuoteSynced, upsertQuoteFromServer, purgeLocalQuote, pruneStaleQuotes,
} from '../db/database'
import {
  isServerReachable,
  fetchAllQuotesFromServer, postQuoteToServer, putQuoteToServer, deleteQuoteFromServer,
} from '../api/client'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

let syncingHome = false

export default function HomeScreen() {
  const { theme: t } = useTheme()
  const { t: tr, locale } = useLang()
  const s = makeStyles(t)
  const [current, setCurrent] = useState(null)

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
  }, [])

  const sync = useCallback(async () => {
    if (syncingHome) return
    syncingHome = true
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
      syncingHome = false
      await load()
    }
  }, [load])

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

        {current && (
          <View style={s.quoteCard}>
            <Text style={s.quoteText}>"{current.text}"</Text>
            {current.author && <Text style={s.quoteAuthor}>— {current.author}</Text>}
          </View>
        )}
      </ScrollView>
    </FadeInView>
  )
}

const makeStyles = (t) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: t.bg },
  content:     { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header:      { marginBottom: 28 },
  greeting:    { color: t.cartoon ? t.accent : t.text, fontSize: 28, fontWeight: '700', letterSpacing: t.cartoon ? 0.5 : -0.5, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
  date:        { color: t.text3, fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  quoteCard:   { backgroundColor: t.surface, borderRadius: t.cartoon ? 14 : 16, padding: 24, marginBottom: 12, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...t.shadow },
  quoteText:   { color: t.text, fontSize: 17, fontStyle: t.cartoon ? 'normal' : 'italic', lineHeight: 28 },
  quoteAuthor: { color: t.text3, fontSize: 12, marginTop: 12, textAlign: 'right' },
})
