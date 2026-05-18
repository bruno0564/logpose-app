import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  TextInput, StyleSheet,
} from 'react-native'
import {
  getCalendarEvents, insertCalendarEvent, updateCalendarEvent,
  markCalendarEventPendingDelete, purgeCalendarEvent,
  markCalendarEventSynced, getUnsyncedCalendarEvents,
  getPendingDeleteCalendarEvents, upsertCalendarEventFromServer,
  getActiveTrainingDays, pruneStaleCalendarEvents,
} from '../db/database'
import {
  isServerReachable,
  fetchAllCalendarEventsFromServer, postCalendarEventToServer,
  putCalendarEventToServer, deleteCalendarEventFromServer,
} from '../api/client'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#d97706', '#dc2626']

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function eventsForDate(events, dateStr, dow) {
  return events.filter(e => {
    if (e.recurrence === 'none') return e.date === dateStr
    if (e.recurrence === 'daily') return true
    if (e.recurrence === 'weekly') {
      const days = e.days_of_week ? e.days_of_week.split(',').map(Number) : []
      return days.includes(dow)
    }
    return false
  })
}

function buildCells(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const offset = (firstWeekday + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  const cells = Array(offset).fill(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

let syncingCalendar = false

function ConfirmModal({ visible, title, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={[s.modal, { borderRadius: 16 }]}>
          <Text style={s.modalTitle}>Eliminar evento</Text>
          <Text style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>¿Eliminar "{title}"?</Text>
          <View style={s.modalBtns}>
            <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={onCancel}>
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: 'rgba(127,29,29,0.8)' }]} onPress={onConfirm}>
              <Text style={[s.btnSaveText, { color: '#fca5a5' }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const BLANK = { title: '', recurrence: 'none', date: '', start_time: '', end_time: '', days_of_week: '', notes: '', color: '#7c3aed' }

export default function CalendarScreen() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [gymDays, setGymDays] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const loadEvents = useCallback(async () => {
    setEvents(await getCalendarEvents())
    const days = await getActiveTrainingDays()
    setGymDays(days.map(d => d.day_of_week))
  }, [])

  const sync = useCallback(async () => {
    if (syncingCalendar) return
    syncingCalendar = true
    try {
      if (!await isServerReachable()) return
      for (const ev of await getUnsyncedCalendarEvents()) {
        if (ev.server_id) {
          await putCalendarEventToServer(ev.server_id, ev)
          await markCalendarEventSynced(ev.id, ev.server_id)
        } else {
          const created = await postCalendarEventToServer(ev)
          await markCalendarEventSynced(ev.id, created.id)
        }
      }
      for (const ev of await getPendingDeleteCalendarEvents()) {
        await deleteCalendarEventFromServer(ev.server_id)
        await purgeCalendarEvent(ev.id)
      }
      const serverEvents = await fetchAllCalendarEventsFromServer()
      for (const ev of serverEvents) await upsertCalendarEventFromServer(ev)
      await pruneStaleCalendarEvents(new Set(serverEvents.map(ev => ev.id)))
    } catch {} finally {
      syncingCalendar = false
      await loadEvents()
    }
  }, [loadEvents])

  useFocusEffect(
    useCallback(() => {
      loadEvents().then(() => sync())
    }, [loadEvents, sync])
  )

  function openCreate(dateStr) {
    setEditingEvent(null)
    setForm({ ...BLANK, date: dateStr || '' })
    setModalVisible(true)
  }

  function openEdit(ev) {
    setEditingEvent(ev)
    setForm({
      title: ev.title, recurrence: ev.recurrence,
      date: ev.date || '', start_time: ev.start_time || '',
      end_time: ev.end_time || '', days_of_week: ev.days_of_week || '',
      notes: ev.notes || '', color: ev.color || '#7c3aed',
    })
    setModalVisible(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    const data = {
      ...form,
      date: form.recurrence === 'none' ? form.date : null,
      days_of_week: form.recurrence === 'weekly' ? form.days_of_week : null,
    }
    if (editingEvent) {
      await updateCalendarEvent(editingEvent.id, data)
    } else {
      await insertCalendarEvent(data)
    }
    setModalVisible(false)
    await loadEvents()
    sync()
  }

  function handleDelete(ev) {
    setConfirmTarget(ev)
  }

  async function confirmDelete() {
    const ev = confirmTarget
    setConfirmTarget(null)
    if (ev.server_id) { await markCalendarEventPendingDelete(ev.id) }
    else { await purgeCalendarEvent(ev.id) }
    await loadEvents()
    sync()
  }

  // ── Vista día ────────────────────────────────────────────────────────────────

  if (selectedDate) {
    const dateStr = toDateStr(selectedDate)
    const dow = (selectedDate.getDay() + 6) % 7
    const dayEvents = eventsForDate(events, dateStr, dow)
      .slice()
      .sort((a, b) => (a.start_time || '') < (b.start_time || '') ? -1 : 1)
    const isGym = gymDays.includes(dow)

    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setSelectedDate(null)} style={s.backBtn}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.dayTitle}>{DAYS_FULL[dow]}</Text>
            <Text style={s.daySubtitle}>{selectedDate.getDate()} de {MONTHS_SHORT[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => openCreate(dateStr)}>
            <Text style={s.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {isGym && (
          <View style={s.gymBanner}>
            <Text style={s.gymBannerText}>🏋 Día de entreno</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {dayEvents.length === 0 ? (
            <Text style={s.emptyText}>Sin eventos. Pulsa + para crear uno.</Text>
          ) : (
            dayEvents.map(ev => (
              <TouchableOpacity key={ev.id} style={[s.eventCard, { borderLeftColor: ev.color || '#7c3aed' }]} onPress={() => openEdit(ev)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.eventTitle}>{ev.title}</Text>
                  {ev.start_time ? (
                    <Text style={s.eventTime}>{ev.start_time}{ev.end_time ? ` — ${ev.end_time}` : ''}</Text>
                  ) : null}
                  {ev.notes ? <Text style={s.eventNotes}>{ev.notes}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDelete(ev)} hitSlop={10}>
                  <Text style={s.deleteIcon}>×</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <EventModal
          visible={modalVisible}
          form={form}
          setForm={setForm}
          editingEvent={editingEvent}
          onSave={handleSave}
          onClose={() => setModalVisible(false)}
        />
        <ConfirmModal
          visible={confirmTarget !== null}
          title={confirmTarget?.title ?? ''}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      </View>
    )
  }

  // ── Vista mes ────────────────────────────────────────────────────────────────

  const cells = buildCells(year, month)
  const isThisMonth = year === today.getFullYear() && month === today.getMonth()

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Calendario</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => openCreate(toDateStr(today))}>
          <Text style={s.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <View style={s.monthRow}>
          <TouchableOpacity onPress={prev} style={s.arrowBtn}>
            <Text style={s.arrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={next} style={s.arrowBtn}>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.dayRow}>
          {DAY_LABELS.map(d => <Text key={d} style={s.dayLabel}>{d}</Text>)}
        </View>

        <View style={s.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={i} style={s.cell} />
            const d = new Date(year, month, day)
            const dateStr = toDateStr(d)
            const dow = (d.getDay() + 6) % 7
            const isToday = isThisMonth && day === today.getDate()
            const isGym = gymDays.includes(dow)
            const dayEvs = eventsForDate(events, dateStr, dow)
            return (
              <TouchableOpacity key={i} style={s.cell} onPress={() => setSelectedDate(d)}>
                <View style={s.cellTop}>
                  <View style={[s.dayWrap, isToday && s.todayWrap]}>
                    <Text style={[s.dayNum, isToday && s.todayNum]}>{day}</Text>
                  </View>
                  {isGym && <Text style={s.gymDot}>🏋</Text>}
                </View>
                <View style={s.dotRow}>
                  {dayEvs.slice(0, 3).map((ev, ei) => (
                    <View key={ei} style={[s.dot, { backgroundColor: ev.color || '#7c3aed' }]} />
                  ))}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <EventModal
        visible={modalVisible}
        form={form}
        setForm={setForm}
        editingEvent={editingEvent}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
      />
      <ConfirmModal
        visible={confirmTarget !== null}
        title={confirmTarget?.title ?? ''}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </View>
  )
}

// ── Modal de crear/editar evento ──────────────────────────────────────────────

function EventModal({ visible, form, setForm, editingEvent, onSave, onClose }) {
  const REC = ['none', 'daily', 'weekly']
  const REC_LABEL = ['Una vez', 'Diaria', 'Semanal']

  function toggleDay(idx) {
    const current = form.days_of_week ? form.days_of_week.split(',').map(Number).filter(n => !isNaN(n)) : []
    const next = current.includes(idx) ? current.filter(d => d !== idx) : [...current, idx]
    setForm(f => ({ ...f, days_of_week: next.sort().join(',') }))
  }

  const selectedDays = form.days_of_week ? form.days_of_week.split(',').map(Number).filter(n => !isNaN(n)) : []

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <ScrollView style={s.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={s.modalTitle}>{editingEvent ? 'Editar evento' : 'Nuevo evento'}</Text>

          <TextInput
            style={s.input}
            placeholder="Título..."
            placeholderTextColor="#555"
            autoFocus
            value={form.title}
            onChangeText={t => setForm(f => ({ ...f, title: t }))}
          />

          {/* Recurrencia */}
          <View style={s.recRow}>
            {REC.map((r, i) => (
              <TouchableOpacity
                key={r}
                style={[s.recBtn, form.recurrence === r && s.recBtnActive]}
                onPress={() => setForm(f => ({ ...f, recurrence: r }))}
              >
                <Text style={[s.recBtnText, form.recurrence === r && s.recBtnTextActive]}>
                  {REC_LABEL[i]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fecha (una vez) */}
          {form.recurrence === 'none' && (
            <TextInput
              style={s.input}
              placeholder="Fecha (YYYY-MM-DD)"
              placeholderTextColor="#555"
              value={form.date}
              onChangeText={t => setForm(f => ({ ...f, date: t }))}
            />
          )}

          {/* Días (semanal) */}
          {form.recurrence === 'weekly' && (
            <View style={s.daySelector}>
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[s.dayToggle, selectedDays.includes(idx) && s.dayToggleActive]}
                  onPress={() => toggleDay(idx)}
                >
                  <Text style={[s.dayToggleText, selectedDays.includes(idx) && s.dayToggleTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Horario */}
          <View style={s.timeRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Inicio HH:MM"
              placeholderTextColor="#555"
              value={form.start_time}
              onChangeText={t => setForm(f => ({ ...f, start_time: t }))}
            />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Fin HH:MM"
              placeholderTextColor="#555"
              value={form.end_time}
              onChangeText={t => setForm(f => ({ ...f, end_time: t }))}
            />
          </View>

          {/* Color */}
          <View style={s.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.colorDot, { backgroundColor: c }, form.color === c && s.colorDotActive]}
                onPress={() => setForm(f => ({ ...f, color: c }))}
              />
            ))}
          </View>

          {/* Notas */}
          <TextInput
            style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Notas (opcional)"
            placeholderTextColor="#555"
            multiline
            value={form.notes}
            onChangeText={t => setForm(f => ({ ...f, notes: t }))}
          />

          <View style={s.modalBtns}>
            <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={onClose}>
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnSave]} onPress={onSave}>
              <Text style={s.btnSaveText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0f0f0f' },
  header:           { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, gap: 12 },
  title:            { color: '#fff', fontSize: 22, fontWeight: '700', flex: 1 },
  addBtn:           { backgroundColor: '#7c3aed', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtnText:       { color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '300' },
  backBtn:          { padding: 4 },
  backArrow:        { color: '#7c3aed', fontSize: 32, lineHeight: 36 },
  dayTitle:         { color: '#fff', fontSize: 18, fontWeight: '700' },
  daySubtitle:      { color: '#666', fontSize: 13 },
  gymBanner:        { backgroundColor: '#1a1a1a', marginHorizontal: 16, borderRadius: 8, padding: 10, marginBottom: 4 },
  gymBannerText:    { color: '#888', fontSize: 13 },

  // Mes
  card:             { backgroundColor: '#1a1a1a', borderRadius: 16, marginHorizontal: 16, padding: 20 },
  monthRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  arrowBtn:         { padding: 8 },
  arrow:            { color: '#7c3aed', fontSize: 28, lineHeight: 30 },
  monthLabel:       { color: '#fff', fontSize: 17, fontWeight: '600' },
  dayRow:           { flexDirection: 'row', marginBottom: 6 },
  dayLabel:         { flex: 1, textAlign: 'center', color: '#444', fontSize: 12, fontWeight: '600' },
  grid:             { flexDirection: 'row', flexWrap: 'wrap' },
  cell:             { width: '14.2857%', alignItems: 'center', paddingVertical: 2 },
  cellTop:          { flexDirection: 'row', alignItems: 'center', gap: 1 },
  dayWrap:          { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todayWrap:        { backgroundColor: '#7c3aed' },
  dayNum:           { color: '#888', fontSize: 13 },
  todayNum:         { color: '#fff', fontWeight: '700', fontSize: 13 },
  gymDot:           { fontSize: 9 },
  dotRow:           { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot:              { width: 5, height: 5, borderRadius: 3 },

  // Día
  emptyText:        { color: '#333', fontSize: 14, textAlign: 'center', marginTop: 60 },
  eventCard:        { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderLeftWidth: 3, gap: 10 },
  eventTitle:       { color: '#fff', fontSize: 14, fontWeight: '600' },
  eventTime:        { color: '#888', fontSize: 12, marginTop: 3 },
  eventNotes:       { color: '#555', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  deleteIcon:       { color: '#ef4444', fontSize: 20, lineHeight: 22 },

  // Modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:            { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:       { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  input:            { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10 },
  recRow:           { flexDirection: 'row', gap: 8, marginBottom: 10 },
  recBtn:           { flex: 1, borderRadius: 8, padding: 9, alignItems: 'center', backgroundColor: '#2a2a2a' },
  recBtnActive:     { backgroundColor: '#7c3aed' },
  recBtnText:       { color: '#666', fontSize: 13, fontWeight: '600' },
  recBtnTextActive: { color: '#fff' },
  daySelector:      { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dayToggle:        { flex: 1, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2a2a' },
  dayToggleActive:  { backgroundColor: '#7c3aed' },
  dayToggleText:    { color: '#555', fontSize: 12, fontWeight: '700' },
  dayToggleTextActive: { color: '#fff' },
  timeRow:          { flexDirection: 'row', gap: 10, marginBottom: 0 },
  colorRow:         { flexDirection: 'row', gap: 12, marginBottom: 10, marginTop: 4 },
  colorDot:         { width: 28, height: 28, borderRadius: 14 },
  colorDotActive:   { borderWidth: 3, borderColor: '#fff' },
  modalBtns:        { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn:              { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnCancel:        { backgroundColor: '#2a2a2a' },
  btnCancelText:    { color: '#888', fontWeight: '600' },
  btnSave:          { backgroundColor: '#7c3aed' },
  btnSaveText:      { color: '#fff', fontWeight: '700' },
})
