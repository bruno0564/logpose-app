import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native'
import {
  getLocalEntries, insertLocalEntry, markSynced,
  markPendingDelete, deleteLocalEntry,
  upsertFromServer, getUnsyncedEntries, getPendingDeletes,
} from '../db/database'
import {
  isServerReachable, fetchAllFromServer, postToServer, deleteFromServer,
} from '../api/client'

export default function BodyWeightScreen() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(false)
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const loadLocal = useCallback(async () => {
    const rows = await getLocalEntries()
    setEntries(rows)
  }, [])

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      const reachable = await isServerReachable()
      setOnline(reachable)
      if (!reachable) return

      const unsynced = await getUnsyncedEntries()
      for (const entry of unsynced) {
        const created = await postToServer(entry)
        await markSynced(entry.id, created.id)
      }

      const pendingDeletes = await getPendingDeletes()
      for (const entry of pendingDeletes) {
        await deleteFromServer(entry.server_id)
        await deleteLocalEntry(entry.id)
      }

      const serverEntries = await fetchAllFromServer()
      for (const entry of serverEntries) {
        await upsertFromServer(entry)
      }
    } finally {
      setSyncing(false)
      await loadLocal()
    }
  }, [loadLocal])

  useEffect(() => {
    async function init() {
      await loadLocal()
      setLoading(false)
      await sync()
    }
    init()
  }, [])

  async function handleAdd() {
    if (!weight || !date) return
    await insertLocalEntry(parseFloat(weight), date, note)
    setWeight('')
    setNote('')
    await loadLocal()
    await sync()
  }

  async function handleDelete(entry) {
    await markPendingDelete(entry.id)
    await loadLocal()
    await sync()
  }

  const filtered = entries.filter(e => {
    if (filterFrom && e.date < filterFrom) return false
    if (filterTo && e.date > filterTo) return false
    return true
  })

  const displayEntries = filtered.length > 0 || filterFrom || filterTo ? filtered : entries
  const latest = entries[0]?.weight
  const avg = entries.length
    ? (entries.reduce((sum, e) => sum + e.weight, 0) / entries.length).toFixed(1)
    : null

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Body Weight</Text>

      <View style={s.statusRow}>
        <View style={[s.dot, online ? s.dotOnline : s.dotOffline]} />
        <Text style={s.statusText}>
          {syncing ? 'Sincronizando...' : online ? 'Servidor conectado' : 'Sin servidor — modo local'}
        </Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statVal}>{latest ? `${latest} kg` : '—'}</Text><Text style={s.statLbl}>Último</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{avg ? `${avg} kg` : '—'}</Text><Text style={s.statLbl}>Media</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{entries.length || '—'}</Text><Text style={s.statLbl}>Total</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Nuevo registro</Text>
        <TextInput style={s.input} placeholder="Peso (kg)" placeholderTextColor="#666" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
        <TextInput style={s.input} placeholder="Fecha (YYYY-MM-DD)" placeholderTextColor="#666" value={date} onChangeText={setDate} />
        <TextInput style={s.input} placeholder="Nota (opcional)" placeholderTextColor="#666" value={note} onChangeText={setNote} />
        <TouchableOpacity style={s.btn} onPress={handleAdd}>
          <Text style={s.btnText}>Añadir</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Historial</Text>

        <View style={s.filterRow}>
          <View style={s.filterField}>
            <Text style={s.filterLabel}>Desde</Text>
            <TextInput
              style={s.filterInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#444"
              value={filterFrom}
              onChangeText={setFilterFrom}
            />
          </View>
          <View style={s.filterField}>
            <Text style={s.filterLabel}>Hasta</Text>
            <TextInput
              style={s.filterInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#444"
              value={filterTo}
              onChangeText={setFilterTo}
            />
          </View>
          {(filterFrom || filterTo) && (
            <TouchableOpacity onPress={() => { setFilterFrom(''); setFilterTo('') }} style={s.clearBtn}>
              <Text style={s.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#7c3aed" style={{ marginTop: 16 }} />
        ) : displayEntries.length === 0 ? (
          <Text style={s.hint}>Sin registros en ese rango.</Text>
        ) : (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.col, s.colDate, s.headerText]}>Fecha</Text>
              <Text style={[s.col, s.colWeight, s.headerText]}>Peso</Text>
              <Text style={[s.col, s.colNote, s.headerText]}>Nota</Text>
              <Text style={s.colAction} />
            </View>
            {displayEntries.map(item => (
              <View key={item.id} style={s.row}>
                <Text style={[s.col, s.colDate]}>{item.date}</Text>
                <Text style={[s.col, s.colWeight, s.weightText]}>{item.weight} kg</Text>
                <Text style={[s.col, s.colNote, s.noteText]}>{item.note ?? '—'}</Text>
                <TouchableOpacity onPress={() => handleDelete(item)} style={s.colAction}>
                  <Text style={s.del}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {(filterFrom || filterTo) && (
              <Text style={s.hint}>{displayEntries.length} registro{displayEntries.length !== 1 ? 's' : ''} en el rango</Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0f0f' },
  content:     { padding: 16, paddingTop: 56, paddingBottom: 32 },
  title:       { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  statusRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot:         { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotOnline:   { backgroundColor: '#22c55e' },
  dotOffline:  { backgroundColor: '#ef4444' },
  statusText:  { color: '#888', fontSize: 12 },
  statsRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat:        { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, alignItems: 'center' },
  statVal:     { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLbl:     { color: '#888', fontSize: 11, marginTop: 2 },
  card:        { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 16, marginBottom: 16 },
  cardTitle:   { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  input:       { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 8 },
  btn:         { backgroundColor: '#7c3aed', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  btnText:     { color: '#fff', fontWeight: '600' },
  filterRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  filterField: { flex: 1 },
  filterLabel: { color: '#555', fontSize: 11, marginBottom: 4 },
  filterInput: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, padding: 8, fontSize: 13 },
  clearBtn:    { paddingHorizontal: 8, paddingBottom: 8 },
  clearBtnText:{ color: '#555', fontSize: 16 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingBottom: 6, marginBottom: 4 },
  headerText:  { color: '#555', fontSize: 11, fontWeight: '600' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  col:         { color: '#aaa', fontSize: 13 },
  colDate:     { width: 95 },
  colWeight:   { width: 65 },
  colNote:     { flex: 1 },
  colAction:   { width: 32, alignItems: 'center' },
  weightText:  { color: '#fff', fontWeight: '600' },
  noteText:    { color: '#666', fontSize: 12 },
  del:         { color: '#ef4444', fontSize: 16 },
  hint:        { color: '#555', fontSize: 13, marginTop: 8, textAlign: 'center' },
})
