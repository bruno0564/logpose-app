import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet,
} from 'react-native'
import {
  getQuotes, insertLocalQuote, updateLocalQuote, deleteLocalQuote,
  getUnsyncedQuotes, getPendingDeleteQuotes,
  markQuoteSynced, upsertQuoteFromServer, purgeLocalQuote, pruneStaleQuotes,
} from '../db/database'
import {
  isServerReachable,
  fetchAllQuotesFromServer, postQuoteToServer, putQuoteToServer, deleteQuoteFromServer,
} from '../api/client'

let syncingQuotes = false

export default function QuotesScreen() {
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
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Frases</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {quotes.length === 0 && (
          <Text style={s.emptyText}>Sin frases todavía. Pulsa + para añadir.</Text>
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
              {editingQuote === 'new' ? 'Nueva frase' : 'Editar frase'}
            </Text>
            <TextInput
              style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Escribe la frase..."
              placeholderTextColor="#555"
              multiline
              autoFocus
              value={form.text}
              onChangeText={t => setForm(f => ({ ...f, text: t }))}
            />
            <TextInput
              style={s.input}
              placeholder="Autor (opcional)"
              placeholderTextColor="#555"
              value={form.author}
              onChangeText={t => setForm(f => ({ ...f, author: t }))}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setEditingQuote(null)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSave]} onPress={handleSave}>
                <Text style={s.btnSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmTarget !== null} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setConfirmTarget(null)}>
          <TouchableOpacity activeOpacity={1} style={[s.modal, { borderRadius: 16 }]}>
            <Text style={s.modalTitle}>Eliminar frase</Text>
            <Text style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>¿Eliminar esta frase?</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setConfirmTarget(null)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: 'rgba(127,29,29,0.8)' }]} onPress={confirmDelete}>
                <Text style={[s.btnSaveText, { color: '#fca5a5' }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f0f' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  title:        { color: '#fff', fontSize: 22, fontWeight: '700' },
  addBtn:       { backgroundColor: '#7c3aed', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtnText:   { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '300' },
  content:      { paddingHorizontal: 16, paddingBottom: 40 },
  emptyText:    { color: '#333', fontSize: 14, textAlign: 'center', marginTop: 60 },
  card:         { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  quoteText:    { color: '#ddd', fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
  authorText:   { color: '#555', fontSize: 12, marginTop: 8, textAlign: 'right' },
  actions:      { flexDirection: 'column', gap: 8, alignItems: 'center', paddingTop: 2 },
  actionBtn:    { padding: 4 },
  editIcon:     { color: '#555', fontSize: 16 },
  deleteIcon:   { color: '#ef4444', fontSize: 18, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 44, gap: 12 },
  modalTitle:   { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  input:        { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15 },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn:          { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnCancel:    { backgroundColor: '#2a2a2a' },
  btnCancelText:{ color: '#888', fontWeight: '600' },
  btnSave:      { backgroundColor: '#7c3aed' },
  btnSaveText:  { color: '#fff', fontWeight: '700' },
})
