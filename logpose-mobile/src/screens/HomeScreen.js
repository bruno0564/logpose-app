import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Modal, FlatList, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getQuotes, addQuote, deleteQuote, getLatestWeight } from '../db/database'

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

export default function HomeScreen() {
  const [quotes, setQuotes] = useState([])
  const [current, setCurrent] = useState(null)
  const [latest, setLatest] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [newQuote, setNewQuote] = useState('')

  const load = useCallback(async () => {
    const [qs, lw] = await Promise.all([getQuotes(), getLatestWeight()])
    setQuotes(qs)
    setLatest(lw)
    if (qs.length > 0) setCurrent(qs[Math.floor(Math.random() * qs.length)])
  }, [])

  useEffect(() => { load() }, [])

  function nextQuote() {
    if (quotes.length < 2) return
    let next
    do { next = quotes[Math.floor(Math.random() * quotes.length)] } while (next.id === current?.id)
    setCurrent(next)
  }

  async function handleAdd() {
    if (!newQuote.trim()) return
    await addQuote(newQuote)
    setNewQuote('')
    setModalVisible(false)
    await load()
  }

  async function handleDelete(id) {
    Alert.alert('Eliminar frase', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await deleteQuote(id)
        await load()
      }},
    ])
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Saludo */}
      <View style={s.header}>
        <Text style={s.greeting}>{greeting()}</Text>
        <Text style={s.date}>{formatDate()}</Text>
      </View>

      {/* Stat destacada */}
      {latest && (
        <View style={s.statCard}>
          <Text style={s.statLabel}>Último peso registrado</Text>
          <Text style={s.statValue}>{latest.weight} kg</Text>
          <Text style={s.statSub}>{latest.date}</Text>
        </View>
      )}

      {/* Frase motivacional */}
      <View style={s.quoteCard}>
        <View style={s.quoteHeader}>
          <Ionicons name="chatbubble-ellipses-outline" color="#7c3aed" size={18} />
          <Text style={s.quoteTitle}>Frase del día</Text>
        </View>
        {current ? (
          <Text style={s.quoteText}>"{current.text}"</Text>
        ) : (
          <Text style={s.hint}>Añade tu primera frase abajo.</Text>
        )}
        <View style={s.quoteActions}>
          {quotes.length > 1 && (
            <TouchableOpacity onPress={nextQuote} style={s.quoteBtn}>
              <Ionicons name="shuffle-outline" color="#7c3aed" size={18} />
              <Text style={s.quoteBtnText}>Otra</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setModalVisible(true)} style={s.quoteBtn}>
            <Ionicons name="add-circle-outline" color="#7c3aed" size={18} />
            <Text style={s.quoteBtnText}>Añadir</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={s.quoteBtn}>
            <Ionicons name="list-outline" color="#555" size={18} />
            <Text style={[s.quoteBtnText, { color: '#555' }]}>Ver todas</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal gestión de frases */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Mis frases</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" color="#aaa" size={22} />
              </TouchableOpacity>
            </View>

            <View style={s.addRow}>
              <TextInput
                style={s.addInput}
                placeholder="Nueva frase..."
                placeholderTextColor="#444"
                value={newQuote}
                onChangeText={setNewQuote}
                multiline
              />
              <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
                <Ionicons name="add" color="#fff" size={20} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={quotes}
              keyExtractor={item => String(item.id)}
              style={s.quoteList}
              renderItem={({ item }) => (
                <View style={s.quoteRow}>
                  <Text style={s.quoteRowText}>"{item.text}"</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" color="#ef4444" size={16} />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f0f0f' },
  content:        { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header:         { marginBottom: 28 },
  greeting:       { color: '#fff', fontSize: 26, fontWeight: '700' },
  date:           { color: '#555', fontSize: 13, marginTop: 4 },
  statCard:       { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#7c3aed' },
  statLabel:      { color: '#555', fontSize: 12, marginBottom: 6 },
  statValue:      { color: '#fff', fontSize: 36, fontWeight: '800' },
  statSub:        { color: '#444', fontSize: 12, marginTop: 4 },
  quoteCard:      { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 20 },
  quoteHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  quoteTitle:     { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
  quoteText:      { color: '#ccc', fontSize: 16, fontStyle: 'italic', lineHeight: 24, marginBottom: 16 },
  hint:           { color: '#444', fontSize: 14, marginBottom: 16 },
  quoteActions:   { flexDirection: 'row', gap: 16 },
  quoteBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quoteBtnText:   { color: '#7c3aed', fontSize: 13 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:          { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  addRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  addInput:       { flex: 1, backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 14 },
  addBtn:         { backgroundColor: '#7c3aed', borderRadius: 10, width: 44, alignItems: 'center', justifyContent: 'center' },
  quoteList:      { flex: 1 },
  quoteRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222', gap: 12 },
  quoteRowText:   { flex: 1, color: '#aaa', fontSize: 14, fontStyle: 'italic' },
})
