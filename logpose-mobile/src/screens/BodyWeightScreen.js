import { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal,
} from 'react-native'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import { Ionicons } from '@expo/vector-icons'
import GradientButton from '../components/GradientButton'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'
import DatePicker from '../components/DatePicker'
import { LineChart } from 'react-native-chart-kit'
import {
  getLocalEntries, insertLocalEntry, updateLocalEntry, markSynced,
  markPendingDelete, deleteLocalEntry,
  upsertFromServer, getUnsyncedEntries, getPendingDeletes, pruneEntriesDeletedFromServer,
} from '../db/database'
import {
  isServerReachable, fetchAllBodyWeightFromServer, postBodyWeightToServer, putBodyWeightToServer, deleteBodyWeightFromServer,
} from '../api/client'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

const SCREEN_W = Dimensions.get('window').width

export default function BodyWeightScreen() {
  const { theme: t } = useTheme()
  const { t: tr, tp } = useLang()
  const s = makeStyles(t)
  const todayStr = new Date().toISOString().split('T')[0]  // tope: no pesarse en el futuro
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [filterFrom, setFilterFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [filterTo, setFilterTo] = useState(new Date().toISOString().split('T')[0])
  const [showFromPicker, setShowFromPicker] = useState(false)
  const [showToPicker, setShowToPicker] = useState(false)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [showEditPicker, setShowEditPicker] = useState(false)
  const syncingRef = useRef(false)

  const loadLocal = useCallback(async () => {
    const rows = await getLocalEntries()
    setEntries(rows)
  }, [])

  const sync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const reachable = await isServerReachable()
      if (!reachable) return
      const unsynced = await getUnsyncedEntries()
      for (const entry of unsynced) {
        if (entry.server_id) {
          await putBodyWeightToServer(entry.server_id, entry)
          await markSynced(entry.id, entry.server_id)
        } else {
          const created = await postBodyWeightToServer(entry)
          await markSynced(entry.id, created.id)
        }
      }
      const pendingDeletes = await getPendingDeletes()
      for (const entry of pendingDeletes) {
        await deleteBodyWeightFromServer(entry.server_id)
        await deleteLocalEntry(entry.id)
      }
      const serverEntries = await fetchAllBodyWeightFromServer()
      const serverIds = new Set(serverEntries.map(e => e.id))
      for (const entry of serverEntries) {
        await upsertFromServer(entry)
      }
      await pruneEntriesDeletedFromServer(serverIds)
    } finally {
      syncingRef.current = false
      setSyncing(false)
      await loadLocal()
    }
  }, [loadLocal])

  useFocusEffect(
    useCallback(() => {
      async function init() {
        await loadLocal()
        setLoading(false)
        sync()
      }
      init()
    }, [loadLocal, sync])
  )

  async function handleAdd() {
    if (!weight || !date) return
    await insertLocalEntry(parseFloat(weight), date, note)
    setWeight('')
    setNote('')
    await loadLocal()
    await sync()
  }

  async function handleDelete(entry) {
    if (entry.server_id) { await markPendingDelete(entry.id) }
    else { await deleteLocalEntry(entry.id) }
    await loadLocal()
    await sync()
  }

  async function handleEditSave() {
    if (!editEntry?.weight || !editEntry?.date) return
    await updateLocalEntry(editEntry.id, parseFloat(editEntry.weight), editEntry.date, editEntry.note || null)
    setEditEntry(null)
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
    if (multiYear) return `${e.date.slice(5, 7)}/${e.date.slice(2, 4)}`
    return `${e.date.slice(8)}/${e.date.slice(5, 7)}`
  })

  const chartData = {
    labels: chartLabels,
    datasets: [{ data: chartSource.map(e => e.weight) }],
  }

  return (
    <>
    <FadeInView style={s.container}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{tr('bodyWeight.title')}</Text>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statVal}>{latest ? `${latest} kg` : '—'}</Text><Text style={s.statLbl}>{tr('bodyWeight.statLatest')}</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{avg ? `${avg} kg` : '—'}</Text><Text style={s.statLbl}>{tr('bodyWeight.statAvg')}</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{entries.length || '—'}</Text><Text style={s.statLbl}>{tr('bodyWeight.statTotal')}</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{tr('bodyWeight.newEntry')}</Text>
        <TextInput
          style={s.input}
          placeholder={tr('bodyWeight.weightPh')}
          placeholderTextColor={t.text3}
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
        />
        <TouchableOpacity style={s.datePicker} onPress={() => setShowAddPicker(true)}>
          <Text style={s.datePickerText}>{date}</Text>
          <Ionicons name="calendar-outline" size={16} color={t.text3} />
        </TouchableOpacity>
        <DatePicker
          visible={showAddPicker}
          value={date}
          max={todayStr}
          onClose={() => setShowAddPicker(false)}
          onSelect={setDate}
        />
        <TextInput
          style={s.input}
          placeholder={tr('bodyWeight.notePh')}
          placeholderTextColor={t.text3}
          value={note}
          onChangeText={setNote}
        />
        <GradientButton onPress={handleAdd} label={tr('bodyWeight.add')} style={{ marginTop: 4 }} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{tr('bodyWeight.history')}</Text>

        <View style={s.filterRow}>
          <TouchableOpacity style={s.filterBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={s.filterLabel}>{tr('bodyWeight.filterFrom')}</Text>
            <Text style={s.filterValue}>{filterFrom || '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.filterBtn} onPress={() => setShowToPicker(true)}>
            <Text style={s.filterLabel}>{tr('bodyWeight.filterTo')}</Text>
            <Text style={s.filterValue}>{filterTo || '—'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            setFilterFrom(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
            setFilterTo(new Date().toISOString().split('T')[0])
          }} style={s.clearBtn}>
            <Text style={s.clearBtnText}>↺</Text>
          </TouchableOpacity>
        </View>

        <DatePicker
          visible={showFromPicker}
          value={filterFrom}
          onClose={() => setShowFromPicker(false)}
          onSelect={setFilterFrom}
        />
        <DatePicker
          visible={showToPicker}
          value={filterTo}
          onClose={() => setShowToPicker(false)}
          onSelect={setFilterTo}
        />

        {loading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} />
        ) : hasChart ? (
          <View style={s.chartWrap}>
            <LineChart
              data={chartData}
              width={SCREEN_W - 64}
              height={180}
              chartConfig={{
                backgroundColor: t.surface2,
                backgroundGradientFrom: t.surface2,
                backgroundGradientTo: t.surface2,
                decimalPlaces: 1,
                color: () => t.accent,
                labelColor: () => t.text3,
                propsForDots: { r: '3', strokeWidth: '1', stroke: t.accent },
                propsForBackgroundLines: { stroke: t.border },
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
          <Text style={s.hint}>{tr('bodyWeight.chartHint')}</Text>
        ) : null}

        {!loading && displayed.length === 0 ? (
          <Text style={s.hint}>{filterFrom || filterTo ? tr('bodyWeight.noRecordsRange') : tr('bodyWeight.noRecords')}</Text>
        ) : (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.col, s.colDate, s.headerText]}>{tr('bodyWeight.tableDate')}</Text>
              <Text style={[s.col, s.colWeight, s.headerText]}>{tr('bodyWeight.tableWeight')}</Text>
              <Text style={[s.col, s.colNote, s.headerText]}>{tr('bodyWeight.tableNote')}</Text>
              <Text style={s.colAction} />
            </View>
            {displayed.map(item => (
              <View key={item.id} style={s.row}>
                <Text style={[s.col, s.colDate]}>{item.date}</Text>
                <Text style={[s.col, s.colWeight, s.weightText]}>{item.weight} kg</Text>
                <Text style={[s.col, s.colNote, s.noteText]}>{item.note ?? '—'}</Text>
                <View style={[s.colAction, { flexDirection: 'row', gap: 4 }]}>
                  <TouchableOpacity onPress={() => setEditEntry({ ...item, weight: String(item.weight) })}>
                    <Ionicons name="pencil" size={14} color={t.text3} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={s.del}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {(filterFrom || filterTo) && (
              <Text style={s.hint}>{tp('bodyWeight.rangeCount', displayed.length)}</Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
    </FadeInView>

      <Modal visible={!!editEntry} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{tr('bodyWeight.editTitle')}</Text>
            <TextInput
              style={s.input}
              placeholder={tr('bodyWeight.weightPh')}
              placeholderTextColor={t.text3}
              keyboardType="decimal-pad"
              value={editEntry?.weight ?? ''}
              onChangeText={v => setEditEntry(e => ({ ...e, weight: v }))}
            />
            <TouchableOpacity style={s.datePicker} onPress={() => setShowEditPicker(true)}>
              <Text style={s.datePickerText}>{editEntry?.date ?? ''}</Text>
              <Ionicons name="calendar-outline" size={16} color={t.text3} />
            </TouchableOpacity>
            <DatePicker
              visible={showEditPicker}
              value={editEntry?.date ?? ''}
              max={todayStr}
              onClose={() => setShowEditPicker(false)}
              onSelect={(d) => setEditEntry(e => ({ ...e, date: d }))}
            />
            <TextInput
              style={s.input}
              placeholder={tr('bodyWeight.notePh')}
              placeholderTextColor={t.text3}
              value={editEntry?.note ?? ''}
              onChangeText={v => setEditEntry(e => ({ ...e, note: v }))}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: t.border2 }]} onPress={() => setEditEntry(null)}>
                <Text style={[s.btnText, { color: t.text2 }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={handleEditSave}>
                <Text style={s.btnText}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const makeStyles = (t) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: t.bg },
  content:      { padding: 16, paddingTop: 20, paddingBottom: 32 },
  title:        { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', marginBottom: 8, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat:         { flex: 1, backgroundColor: t.surface2, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  statVal:      { color: t.cartoon ? t.accent : t.text, fontSize: 18, fontWeight: '700', fontFamily: t.fontTitle },
  statLbl:      { color: t.text2, fontSize: 11, marginTop: 2 },
  card:         { backgroundColor: t.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: t.cardBorderWidth, borderColor: t.cardBorderColor, ...t.shadow },
  cardTitle:    { color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 12, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', letterSpacing: t.cartoon ? 0.5 : 0 },
  input:        { backgroundColor: t.border2, color: t.text, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  datePicker:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.border2, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  datePickerText: { color: t.text },
  datePickerIcon: { fontSize: 16 },
  btn:          { backgroundColor: t.accent, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  btnText:      { color: t.cartoon ? t.bg : t.text, fontWeight: '600', fontFamily: t.fontTitle },
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  filterBtn:    { flex: 1, backgroundColor: t.border2, borderRadius: 8, padding: 10, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  filterLabel:  { color: t.text3, fontSize: 10, marginBottom: 2 },
  filterValue:  { color: t.text, fontSize: 13 },
  clearBtn:     { padding: 8 },
  clearBtnText: { color: t.text3, fontSize: 16 },
  chartWrap:    { marginVertical: 12, alignItems: 'center' },
  tableHeader:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.border2, paddingBottom: 6, marginBottom: 4, marginTop: 8 },
  headerText:   { color: t.text3, fontSize: 11, fontWeight: '600' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
  col:          { color: t.text2, fontSize: 13 },
  colDate:      { width: 95 },
  colWeight:    { width: 65 },
  colNote:      { flex: 1 },
  colAction:    { width: 32, alignItems: 'center' },
  weightText:   { color: t.text, fontWeight: '600' },
  noteText:     { color: t.text3, fontSize: 12 },
  del:          { color: t.danger, fontSize: 14 },
  editBtn:      { color: t.text3, fontSize: 14 },
  hint:         { color: t.text3, fontSize: 13, marginTop: 8, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: t.surface2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 10, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor },
  modalTitle:   { color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 4, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
})
