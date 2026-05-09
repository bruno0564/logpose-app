import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, ScrollView, Dimensions,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { LineChart } from 'react-native-chart-kit'
import {
  getLocalEntries, insertLocalEntry, markSynced,
  markPendingDelete, deleteLocalEntry,
  upsertFromServer, getUnsyncedEntries, getPendingDeletes,
} from '../db/database'
import {
  isServerReachable, fetchAllFromServer, postToServer, deleteFromServer,
} from '../api/client'

const SCREEN_W = Dimensions.get('window').width

export default function BodyWeightScreen() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [showFromPicker, setShowFromPicker] = useState(false)
  const [showToPicker, setShowToPicker] = useState(false)
  const [showAddPicker, setShowAddPicker] = useState(false)

  const loadLocal = useCallback(async () => {
    const rows = await getLocalEntries()
    setEntries(rows)
  }, [])

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      const reachable = await isServerReachable()
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

  const displayed = entries.filter(e => {
    if (filterFrom && e.date < filterFrom) return false
    if (filterTo && e.date > filterTo) return false
    return true
  })

  const latest = entries[0]?.weight
  const avg = entries.length
    ? (entries.reduce((s, e) => s + e.weight, 0) / entries.length).toFixed(1)
    : null

  // Chart
  const chartSource = [...displayed].reverse().slice(-60)
  const hasChart = chartSource.length >= 2

  const multiYear = hasChart &&
    chartSource[0].date.slice(0, 4) !== chartSource[chartSource.length - 1].date.slice(0, 4)

  const MAX_LABELS = 5
  const labelIndices = new Set()
  if (chartSource.length <= MAX_LABELS) {
    chartSource.forEach((_, i) => labelIndices.add(i))
  } else {
    for (let i = 0; i < MAX_LABELS; i++) {
      labelIndices.add(Math.round(i * (chartSource.length - 1) / (MAX_LABELS - 1)))
    }
  }

  const chartLabels = chartSource.map((e, i) => {
    if (!labelIndices.has(i)) return ''
    // Multi-year: show MM/YY — same year: show DD/MM
    if (multiYear) return `${e.date.slice(5, 7)}/${e.date.slice(2, 4)}`
    return `${e.date.slice(8)}/${e.date.slice(5, 7)}`
  })

  const chartData = {
    labels: chartLabels,
    datasets: [{ data: chartSource.map(e => e.weight) }],
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Body Weight</Text>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statVal}>{latest ? `${latest} kg` : '—'}</Text><Text style={s.statLbl}>Último</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{avg ? `${avg} kg` : '—'}</Text><Text style={s.statLbl}>Media</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{entries.length || '—'}</Text><Text style={s.statLbl}>Total</Text></View>
      </View>

      {/* Formulario nuevo registro */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Nuevo registro</Text>
        <TextInput
          style={s.input}
          placeholder="Peso (kg)"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
        />
        <TouchableOpacity style={s.datePicker} onPress={() => setShowAddPicker(true)}>
          <Text style={s.datePickerText}>{date}</Text>
          <Text style={s.datePickerIcon}>📅</Text>
        </TouchableOpacity>
        {showAddPicker && (
          <DateTimePicker
            value={new Date(date + 'T12:00:00')}
            mode="date"
            display="calendar"
            onChange={(_, selected) => {
              setShowAddPicker(false)
              if (selected) setDate(selected.toISOString().split('T')[0])
            }}
          />
        )}
        <TextInput
          style={s.input}
          placeholder="Nota (opcional)"
          placeholderTextColor="#666"
          value={note}
          onChangeText={setNote}
        />
        <TouchableOpacity style={s.btn} onPress={handleAdd}>
          <Text style={s.btnText}>Añadir</Text>
        </TouchableOpacity>
      </View>

      {/* Historial con filtro y gráfica */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Historial</Text>

        {/* Filtro de fechas */}
        <View style={s.filterRow}>
          <TouchableOpacity style={s.filterBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={s.filterLabel}>Desde</Text>
            <Text style={s.filterValue}>{filterFrom || '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.filterBtn} onPress={() => setShowToPicker(true)}>
            <Text style={s.filterLabel}>Hasta</Text>
            <Text style={s.filterValue}>{filterTo || '—'}</Text>
          </TouchableOpacity>
          {(filterFrom || filterTo) && (
            <TouchableOpacity onPress={() => { setFilterFrom(''); setFilterTo('') }} style={s.clearBtn}>
              <Text style={s.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {showFromPicker && (
          <DateTimePicker
            value={filterFrom ? new Date(filterFrom + 'T12:00:00') : new Date()}
            mode="date"
            display="calendar"
            onChange={(_, selected) => {
              setShowFromPicker(false)
              if (selected) setFilterFrom(selected.toISOString().split('T')[0])
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={filterTo ? new Date(filterTo + 'T12:00:00') : new Date()}
            mode="date"
            display="calendar"
            onChange={(_, selected) => {
              setShowToPicker(false)
              if (selected) setFilterTo(selected.toISOString().split('T')[0])
            }}
          />
        )}

        {/* Gráfica */}
        {loading ? (
          <ActivityIndicator color="#7c3aed" style={{ marginTop: 16 }} />
        ) : hasChart ? (
          <View style={s.chartWrap}>
            <LineChart
              data={chartData}
              width={SCREEN_W - 64}
              height={180}
              chartConfig={{
                backgroundColor: '#1a1a1a',
                backgroundGradientFrom: '#1a1a1a',
                backgroundGradientTo: '#1a1a1a',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(124, 58, 237, ${opacity})`,
                labelColor: () => '#555',
                propsForDots: { r: '3', strokeWidth: '1', stroke: '#7c3aed' },
                propsForBackgroundLines: { stroke: '#222' },
              }}
              bezier
              withInnerLines={true}
              withOuterLines={false}
              horizontalLabelRotation={-30}
              xLabelsOffset={-4}
              style={{ borderRadius: 8 }}
            />
          </View>
        ) : displayed.length === 1 ? (
          <Text style={s.hint}>Añade al menos 2 registros para ver la gráfica.</Text>
        ) : null}

        {/* Tabla */}
        {!loading && displayed.length === 0 ? (
          <Text style={s.hint}>Sin registros{filterFrom || filterTo ? ' en ese rango' : ''}.</Text>
        ) : (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.col, s.colDate, s.headerText]}>Fecha</Text>
              <Text style={[s.col, s.colWeight, s.headerText]}>Peso</Text>
              <Text style={[s.col, s.colNote, s.headerText]}>Nota</Text>
              <Text style={s.colAction} />
            </View>
            {displayed.map(item => (
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
              <Text style={s.hint}>{displayed.length} registro{displayed.length !== 1 ? 's' : ''} en el rango</Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f0f' },
  content:      { padding: 16, paddingTop: 56, paddingBottom: 32 },
  title:        { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat:         { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, alignItems: 'center' },
  statVal:      { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLbl:      { color: '#888', fontSize: 11, marginTop: 2 },
  card:         { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 16, marginBottom: 16 },
  cardTitle:    { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  input:        { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 8 },
  datePicker:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 8, padding: 10, marginBottom: 8 },
  datePickerText: { color: '#fff' },
  datePickerIcon: { fontSize: 16 },
  btn:          { backgroundColor: '#7c3aed', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  btnText:      { color: '#fff', fontWeight: '600' },
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  filterBtn:    { flex: 1, backgroundColor: '#2a2a2a', borderRadius: 8, padding: 10 },
  filterLabel:  { color: '#555', fontSize: 10, marginBottom: 2 },
  filterValue:  { color: '#fff', fontSize: 13 },
  clearBtn:     { padding: 8 },
  clearBtnText: { color: '#555', fontSize: 16 },
  chartWrap:    { marginVertical: 12, alignItems: 'center' },
  tableHeader:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingBottom: 6, marginBottom: 4, marginTop: 8 },
  headerText:   { color: '#555', fontSize: 11, fontWeight: '600' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  col:          { color: '#aaa', fontSize: 13 },
  colDate:      { width: 95 },
  colWeight:    { width: 65 },
  colNote:      { flex: 1 },
  colAction:    { width: 32, alignItems: 'center' },
  weightText:   { color: '#fff', fontWeight: '600' },
  noteText:     { color: '#666', fontSize: 12 },
  del:          { color: '#ef4444', fontSize: 16 },
  hint:         { color: '#555', fontSize: 13, marginTop: 8, textAlign: 'center' },
})
