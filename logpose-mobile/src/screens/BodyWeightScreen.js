import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert
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

  const latest = entries[0]?.weight
  const avg = entries.length
    ? (entries.reduce((s, e) => s + e.weight, 0) / entries.length).toFixed(1)
    : null

  return (
    <View style={s.container}>
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

      {loading ? (
        <ActivityIndicator color="#7c3aed" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => String(item.id)}
          style={s.list}
          renderItem={({ item }) => (
            <View style={s.row}>
              <Text style={s.rowDate}>{item.date}</Text>
              <Text style={s.rowWeight}>{item.weight} kg</Text>
              <Text style={s.rowNote}>{item.note ?? '—'}</Text>
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={s.del}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f0f0f', padding: 16, paddingTop: 56 },
  title:      { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot:        { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotOnline:  { backgroundColor: '#22c55e' },
  dotOffline: { backgroundColor: '#ef4444' },
  statusText: { color: '#888', fontSize: 12 },
  statsRow:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat:       { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, alignItems: 'center' },
  statVal:    { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLbl:    { color: '#888', fontSize: 11, marginTop: 2 },
  card:       { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 16, marginBottom: 16 },
  cardTitle:  { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  input:      { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 8 },
  btn:        { backgroundColor: '#7c3aed', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  btnText:    { color: '#fff', fontWeight: '600' },
  list:       { flex: 1 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  rowDate:    { color: '#aaa', width: 90, fontSize: 13 },
  rowWeight:  { color: '#fff', width: 70, fontWeight: '600' },
  rowNote:    { color: '#666', flex: 1, fontSize: 12 },
  del:        { color: '#ef4444', fontSize: 16, paddingHorizontal: 8 },
})
