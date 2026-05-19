import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import {
  getTodayJournalEntry, getAllJournalEntries, saveJournalEntry, getJournalStreak,
  getUnsyncedJournalEntries, getPendingDeleteJournalEntries,
  markJournalEntrySynced, purgeLocalJournalEntry, upsertJournalEntryFromServer, pruneStaleJournalEntries,
} from '../db/database'
import {
  isServerReachable,
  fetchAllJournalEntriesFromServer, postJournalEntryToServer, putJournalEntryToServer, deleteJournalEntryFromServer,
} from '../api/client'

const TODAY = new Date().toISOString().slice(0, 10)

let syncingJournal = false

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return new Date(+y, +m - 1, +d).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function JournalScreen() {
  const [view, setView] = useState('today')
  const [entry, setEntry] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [streak, setStreak] = useState(0)
  const [history, setHistory] = useState([])

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
        if (e.server_id) {
          await putJournalEntryToServer(e.server_id, e)
          await markJournalEntrySynced(e.id, e.server_id)
        } else {
          const created = await postJournalEntryToServer(e)
          await markJournalEntrySynced(e.id, created.id)
        }
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
          <Text style={s.backBtn}>← Volver</Text>
        </TouchableOpacity>
        <Text style={s.title}>Historial</Text>
        <View style={{ height: 16 }} />

        {history.length === 0 ? (
          <Text style={s.hint}>Sin entradas anteriores todavía.</Text>
        ) : (
          history.map(e => (
            <View key={e.id} style={[s.card, { marginBottom: 12 }]}>
              <Text style={s.dateLabel}>{formatDate(e.date)}</Text>
              <Text style={s.entryText}>
                {e.content || <Text style={s.emptyText}>Sin contenido</Text>}
              </Text>
              <Text style={s.wordCount}>{wordCount(e.content)} palabras</Text>
            </View>
          ))
        )}
      </ScrollView>
    )
  }

  const words = wordCount(draft)

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View>
            <Text style={s.title}>Diario</Text>
            <Text style={s.dateLabel}>{formatDate(TODAY)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {streak > 0 && (
              <View style={s.streakBadge}>
                <Text style={s.streakText}>🔥 {streak} {streak === 1 ? 'día' : 'días'}</Text>
              </View>
            )}
            <TouchableOpacity style={s.btnCancel} onPress={openHistory}>
              <Text style={s.btnCancelText}>Historial</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={s.textarea}
          value={draft}
          onChangeText={setDraft}
          placeholder="Escribe sobre tu día..."
          placeholderTextColor="#333"
          multiline
          textAlignVertical="top"
        />

        <View style={s.footer}>
          <Text style={s.wordCount}>{words} {words === 1 ? 'palabra' : 'palabras'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {saved && <Text style={{ color: '#22c55e', fontSize: 12 }}>Guardado</Text>}
            <TouchableOpacity
              style={[s.btnPrimary, (!draft.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving || !draft.trim()}
            >
              <Text style={s.btnPrimaryText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#0a0a0a', padding: 16, paddingTop: 54 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  title:       { color: '#f0f0f0', fontSize: 22, fontWeight: '700' },
  dateLabel:   { color: '#444', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  backBtn:     { color: '#818cf8', fontSize: 14, marginBottom: 12 },
  hint:        { color: '#444', fontSize: 13 },
  card:        { backgroundColor: '#111', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1e1e1e' },
  entryText:   { color: '#888', fontSize: 14, lineHeight: 22 },
  emptyText:   { color: '#333', fontStyle: 'italic' },
  wordCount:   { color: '#333', fontSize: 11, marginTop: 8 },
  streakBadge: { backgroundColor: '#1e1e1e', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#2a2a2a' },
  streakText:  { color: '#888', fontSize: 12 },
  textarea:    { backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 10, color: '#f0f0f0', padding: 14, fontSize: 15, lineHeight: 24, minHeight: 300 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  btnPrimary:  { backgroundColor: '#818cf8', borderRadius: 6, paddingHorizontal: 16, paddingVertical: 9 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnCancel:   { backgroundColor: '#1e1e1e', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  btnCancelText: { color: '#888', fontSize: 13 },
})
