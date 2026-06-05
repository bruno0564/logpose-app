import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, TouchableOpacity, ScrollView,
  Modal, StyleSheet,
} from 'react-native'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'
import GradientButton from '../components/GradientButton'
import {
  getQuotes, insertLocalQuote, updateLocalQuote, deleteLocalQuote,
  getUnsyncedQuotes, getPendingDeleteQuotes,
  markQuoteSynced, upsertQuoteFromServer, purgeLocalQuote, pruneStaleQuotes,
} from '../db/database'
import {
  isServerReachable,
  fetchAllQuotesFromServer, postQuoteToServer, putQuoteToServer, deleteQuoteFromServer,
} from '../api/client'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

let syncingQuotes = false

export default function QuotesScreen() {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const [quotes, setQuotes] = useState([])
  const [editingQuote, setEditingQuote] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [form, setForm] = useState({ text: '', author: '' })

  const loadQuotes = useCallback(async () => {
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
      await loadQuotes()
    }
  }, [loadQuotes])

  useFocusEffect(
    useCallback(() => {
      loadQuotes().then(() => sync())
    }, [loadQuotes, sync])
  )

  function openAdd() {
    setForm({ text: '', author: '' })
    setEditingQuote('new')
  }

  function openEdit(q) {
    setForm({ text: q.text, author: q.author || '' })
    setEditingQuote(q)
  }

  async function handleSave() {
    if (!form.text.trim()) return
    if (editingQuote === 'new') {
      await insertLocalQuote(form.text, form.author)
    } else {
      await updateLocalQuote(editingQuote.id, form.text, form.author)
    }
    setEditingQuote(null)
    await loadQuotes()
    sync()
  }

  function handleDelete(q) {
    setConfirmTarget(q)
  }

  async function confirmDelete() {
    const q = confirmTarget
    setConfirmTarget(null)
    await deleteLocalQuote(q.id)
    await loadQuotes()
    sync()
  }

  return (
    <FadeInView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{tr('quotes.title')}</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {quotes.length === 0 && (
          <Text style={s.emptyText}>{tr('quotes.noQuotesMobile')}</Text>
        )}
        {quotes.map(q => (
          <View key={q.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.quoteText}>"{q.text}"</Text>
              {q.author ? <Text style={s.authorText}>— {q.author}</Text> : null}
            </View>
            <View style={s.actions}>
              <TouchableOpacity onPress={() => openEdit(q)} hitSlop={10} style={s.actionBtn}>
                <Text style={s.editIcon}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(q)} hitSlop={10} style={s.actionBtn}>
                <Text style={s.deleteIcon}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={editingQuote !== null} transparent animationType="slide" onRequestClose={() => setEditingQuote(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              {editingQuote === 'new' ? tr('quotes.newQuote') : tr('quotes.editQuote')}
            </Text>
            <TextInput
              style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder={tr('quotes.quotePh')}
              placeholderTextColor={t.text3}
              multiline
              autoFocus
              value={form.text}
              onChangeText={v => setForm(f => ({ ...f, text: v }))}
            />
            <TextInput
              style={s.input}
              placeholder={tr('quotes.authorPh')}
              placeholderTextColor={t.text3}
              value={form.author}
              onChangeText={v => setForm(f => ({ ...f, author: v }))}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setEditingQuote(null)}>
                <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <GradientButton onPress={handleSave} label={tr('common.save')} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmTarget !== null} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setConfirmTarget(null)}>
          <TouchableOpacity activeOpacity={1} style={[s.modal, { borderRadius: 16 }]}>
            <Text style={s.modalTitle}>{tr('quotes.deleteQuote')}</Text>
            <Text style={{ color: t.text2, fontSize: 14, marginBottom: 4 }}>{tr('quotes.deleteConfirm')}</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setConfirmTarget(null)}>
                <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: t.dangerBg }]} onPress={confirmDelete}>
                <Text style={[s.btnSaveText, { color: t.dangerText }]}>{tr('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </FadeInView>
  )
}

const makeStyles = (t) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: t.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16 },
  title:        { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
  addBtn:       { backgroundColor: t.accent, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  addBtnText:   { color: t.cartoon ? t.bg : t.text, fontSize: 24, lineHeight: 28, fontWeight: '300' },
  content:      { paddingHorizontal: 16, paddingBottom: 40 },
  emptyText:    { color: t.text4, fontSize: 14, textAlign: 'center', marginTop: 60 },
  card:         { backgroundColor: t.surface2, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  quoteText:    { color: t.text, fontSize: 15, fontStyle: t.cartoon ? 'normal' : 'italic', lineHeight: 22 },
  authorText:   { color: t.text3, fontSize: 12, marginTop: 8, textAlign: 'right' },
  actions:      { flexDirection: 'column', gap: 8, alignItems: 'center', paddingTop: 2 },
  actionBtn:    { padding: 4 },
  editIcon:     { color: t.text3, fontSize: 16 },
  deleteIcon:   { color: t.danger, fontSize: 18, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: t.surface2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 44, gap: 12, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor },
  modalTitle:   { color: t.text, fontSize: 16, fontWeight: '700', marginBottom: 4, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
  input:        { backgroundColor: t.border2, color: t.text, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn:          { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  btnCancel:    { backgroundColor: t.border2 },
  btnCancelText:{ color: t.text2, fontWeight: '600', fontFamily: t.fontTitle },
  btnSave:      { backgroundColor: t.accent },
  btnSaveText:  { color: t.cartoon ? t.bg : t.text, fontWeight: '700', fontFamily: t.fontTitle },
})
