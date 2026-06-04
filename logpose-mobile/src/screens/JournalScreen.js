import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import GradientButton from '../components/GradientButton'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'
import {
  getTodayJournalEntry, getAllJournalEntries, saveJournalEntry, getJournalStreak,
  getUnsyncedJournalEntries, getPendingDeleteJournalEntries,
  markJournalEntrySynced, purgeLocalJournalEntry, upsertJournalEntryFromServer, pruneStaleJournalEntries,
} from '../db/database'
import {
  isServerReachable,
  fetchAllJournalEntriesFromServer, postJournalEntryToServer, putJournalEntryToServer, deleteJournalEntryFromServer,
} from '../api/client'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

const TODAY = new Date().toISOString().slice(0, 10)

let syncingJournal = false

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function JournalScreen() {
  const { theme: t } = useTheme()
  const { t: tr, tp, locale } = useLang()
  const s = makeStyles(t)
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

  useFocusEffect(
    useCallback(() => {
      loadToday().then(() => { loadStreak(); syncJournal() })
    }, [loadToday, loadStreak, syncJournal])
  )

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
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => setView('today')} style={{ marginBottom: 12 }}>
          <Text style={s.backBtn}>{tr('journal.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{tr('journal.historyTitle')}</Text>
        <View style={{ height: 16 }} />

        {history.length === 0 ? (
          <Text style={s.hint}>{tr('journal.noHistory')}</Text>
        ) : (
          history.map(e => (
            <View key={e.id} style={[s.card, { marginBottom: 12 }]}>
              <Text style={s.dateLabel}>{formatDate(e.date)}</Text>
              <Text style={s.entryText}>
                {e.content || <Text style={s.emptyText}>{tr('journal.noContent')}</Text>}
              </Text>
              <Text style={s.wordCount}>{tp('journal.wordCount', wordCount(e.content))}</Text>
            </View>
          ))
        )}
      </ScrollView>
    )
  }

  const words = wordCount(draft)

  return (
    <FadeInView style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View>
            <Text style={s.title}>{tr('journal.title')}</Text>
            <Text style={s.dateLabel}>{formatDate(TODAY)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {streak > 0 && (
              <View style={s.streakBadge}>
                <Text style={s.streakText}>{tp('journal.streak', streak)}</Text>
              </View>
            )}
            <TouchableOpacity style={s.btnCancel} onPress={openHistory}>
              <Text style={s.btnCancelText}>{tr('journal.historyBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={s.textarea}
          value={draft}
          onChangeText={setDraft}
          placeholder={tr('journal.placeholder')}
          placeholderTextColor={t.text4}
          multiline
          textAlignVertical="top"
        />

        <View style={s.footer}>
          <Text style={s.wordCount}>{tp('journal.wordCount', words)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {saved && <Text style={{ color: t.success, fontSize: 12 }}>{tr('journal.saved')}</Text>}
            <GradientButton
              onPress={handleSave}
              label={saving ? tr('journal.saving') : tr('journal.save')}
              disabled={!draft.trim()}
              loading={saving}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </FadeInView>
  )
}

const makeStyles = (t) => StyleSheet.create({
  screen:      { flex: 1, backgroundColor: t.bg, padding: 16, paddingTop: 16 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  title:       { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', letterSpacing: t.cartoon ? 0.5 : -0.5, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
  dateLabel:   { color: t.text3, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  backBtn:     { color: t.accent, fontSize: 14, marginBottom: 12 },
  hint:        { color: t.text3, fontSize: 13 },
  card:        { backgroundColor: t.surface, borderRadius: 12, padding: 14, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...t.shadow },
  entryText:   { color: t.text2, fontSize: 14, lineHeight: 22 },
  emptyText:   { color: t.text4, fontStyle: 'italic' },
  wordCount:   { color: t.text4, fontSize: 11, marginTop: 8 },
  streakBadge: { backgroundColor: t.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: t.border2 },
  streakText:  { color: t.text2, fontSize: 12 },
  textarea:    { backgroundColor: t.surface, borderWidth: t.cartoon ? 2 : 1, borderColor: t.cartoon ? t.text : t.border, borderRadius: 10, color: t.text, padding: 14, fontSize: 15, lineHeight: 24, minHeight: 300 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  btnPrimary:  { backgroundColor: t.accent, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 9, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  btnPrimaryText: { color: t.cartoon ? t.bg : t.text, fontSize: 14, fontWeight: '600', fontFamily: t.fontTitle },
  btnCancel:   { backgroundColor: t.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  btnCancelText: { color: t.text2, fontSize: 13 },
})
