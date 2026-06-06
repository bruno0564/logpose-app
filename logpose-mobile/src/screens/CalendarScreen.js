import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, TouchableOpacity, ScrollView, Modal,
  StyleSheet,
} from 'react-native'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import PressableScale from '../components/PressableScale'
import FadeInView from '../components/FadeInView'
import { titleShadow } from '../cartoonStyles'
import DatePicker from '../components/DatePicker'
import TimePicker from '../components/TimePicker'
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
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

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
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={[s.modal, { borderRadius: 16 }]}>
          <Text style={s.modalTitle}>{tr('calendar.deleteEvent')}</Text>
          <Text style={{ color: t.text2, fontSize: 14, marginBottom: 16 }}>
            {tr('calendar.deleteEventMsg', { title })}
          </Text>
          <View style={s.modalBtns}>
            <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={onCancel}>
              <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: t.dangerBg }]} onPress={onConfirm}>
              <Text style={[s.btnSaveText, { color: t.dangerText }]}>{tr('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const BLANK = { title: '', recurrence: 'none', date: '', start_time: '', end_time: '', days_of_week: '', notes: '', color: '#7c3aed' }

export default function CalendarScreen() {
  const { theme: t } = useTheme()
  const { t: tr, locale } = useLang()
  const s = makeStyles(t)
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

  // ── Day view ─────────────────────────────────────────────────────────────────

  if (selectedDate) {
    const dateStr = toDateStr(selectedDate)
    const dow = (selectedDate.getDay() + 6) % 7
    const dayEvents = eventsForDate(events, dateStr, dow)
      .slice()
      .sort((a, b) => (a.start_time || '') < (b.start_time || '') ? -1 : 1)
    const isGym = gymDays.includes(dow)

    const days = t => t('common.days')
    const dayName = tr('common.days')[dow]
    const daySubtitle = selectedDate.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })

    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setSelectedDate(null)} style={s.backBtn}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.dayTitle}>{dayName}</Text>
            <Text style={s.daySubtitle}>{daySubtitle}</Text>
          </View>
          <PressableScale style={s.addBtn} onPress={() => openCreate(dateStr)}>
            <Text style={s.addBtnText}>+</Text>
          </PressableScale>
        </View>

        {isGym && (
          <View style={s.gymBanner}>
            <Text style={s.gymBannerText}>{tr('calendar.gymDay')}</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {dayEvents.length === 0 ? (
            <Text style={s.emptyText}>{tr('calendar.noEvents')}</Text>
          ) : (
            dayEvents.map(ev => (
              <PressableScale key={ev.id} style={[s.eventCard, { borderLeftColor: ev.color || '#7c3aed' }]} onPress={() => openEdit(ev)}>
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
              </PressableScale>
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

  // ── Month view ────────────────────────────────────────────────────────────────

  const cells = buildCells(year, month)
  const isThisMonth = year === today.getFullYear() && month === today.getMonth()
  const monthLabel = new Date(year, month, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const daysShort = tr('common.daysShort')

  return (
    <FadeInView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{tr('calendar.title')}</Text>
        <PressableScale style={s.addBtn} onPress={() => openCreate(toDateStr(today))}>
          <Text style={s.addBtnText}>+</Text>
        </PressableScale>
      </View>

      <View style={s.card}>
        <View style={s.monthRow}>
          <TouchableOpacity onPress={prev} style={s.arrowBtn}>
            <Text style={s.arrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          </Text>
          <TouchableOpacity onPress={next} style={s.arrowBtn}>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.dayRow}>
          {daysShort.map(d => <Text key={d} style={s.dayLabel}>{d}</Text>)}
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
    </FadeInView>
  )
}

// ── Event modal ───────────────────────────────────────────────────────────────

function EventModal({ visible, form, setForm, editingEvent, onSave, onClose }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const daysShort = tr('common.daysShort')

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  const REC = ['none', 'daily', 'weekly']
  const REC_LABEL = [tr('calendar.recNone'), tr('calendar.recDaily'), tr('calendar.recWeekly')]

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
          <Text style={s.modalTitle}>{editingEvent ? tr('calendar.editEvent') : tr('calendar.newEvent')}</Text>

          <TextInput
            style={s.input}
            placeholder={tr('calendar.titlePh')}
            placeholderTextColor={t.text3}
            autoFocus
            value={form.title}
            onChangeText={v => setForm(f => ({ ...f, title: v }))}
          />

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

          {form.recurrence === 'none' && (
            <>
              <TouchableOpacity
                style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: form.date ? t.text : t.text3, fontSize: 14 }}>
                  {form.date || tr('calendar.datePh')}
                </Text>
                <Text>📅</Text>
              </TouchableOpacity>
              <DatePicker
                visible={showDatePicker}
                value={form.date}
                onClose={() => setShowDatePicker(false)}
                onSelect={(d) => setForm(f => ({ ...f, date: d }))}
              />
            </>
          )}

          {form.recurrence === 'weekly' && (
            <View style={s.daySelector}>
              {daysShort.map((label, idx) => (
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

          <View style={s.timeRow}>
            <TouchableOpacity
              style={[s.input, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={{ color: form.start_time ? t.text : t.text3, fontSize: 14 }}>
                {form.start_time || tr('calendar.startTimePh')}
              </Text>
              <Text>🕐</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.input, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={{ color: form.end_time ? t.text : t.text3, fontSize: 14 }}>
                {form.end_time || tr('calendar.endTimePh')}
              </Text>
              <Text>🕐</Text>
            </TouchableOpacity>
          </View>
          <TimePicker
            visible={showStartPicker}
            value={form.start_time}
            onClose={() => setShowStartPicker(false)}
            onSelect={(time) => setForm(f => ({ ...f, start_time: time }))}
          />
          <TimePicker
            visible={showEndPicker}
            value={form.end_time}
            onClose={() => setShowEndPicker(false)}
            onSelect={(time) => setForm(f => ({ ...f, end_time: time }))}
          />

          <View style={s.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.colorDot, { backgroundColor: c }, form.color === c && s.colorDotActive]}
                onPress={() => setForm(f => ({ ...f, color: c }))}
              />
            ))}
          </View>

          <TextInput
            style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder={tr('calendar.notesPh')}
            placeholderTextColor={t.text3}
            multiline
            value={form.notes}
            onChangeText={v => setForm(f => ({ ...f, notes: v }))}
          />

          <View style={s.modalBtns}>
            <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={onClose}>
              <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnSave]} onPress={onSave}>
              <Text style={s.btnSaveText}>{tr('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const makeStyles = (t) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: t.bg },
  header:           { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 16, gap: 12 },
  title:            { color: t.cartoon ? t.accent : t.text, fontSize: 22, fontWeight: '700', flex: 1, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
  addBtn:           { backgroundColor: t.accent, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  addBtnText:       { color: t.cartoon ? t.bg : t.text, fontSize: 24, lineHeight: 28, fontWeight: '300' },
  backBtn:          { padding: 4 },
  backArrow:        { color: t.accent, fontSize: 32, lineHeight: 36 },
  dayTitle:         { color: t.text, fontSize: 18, fontWeight: '700' },
  daySubtitle:      { color: t.text3, fontSize: 13 },
  gymBanner:        { backgroundColor: t.surface2, marginHorizontal: 16, borderRadius: 8, padding: 10, marginBottom: 4 },
  gymBannerText:    { color: t.text2, fontSize: 13 },
  card:             { backgroundColor: t.surface2, borderRadius: 16, marginHorizontal: 16, padding: 20, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  monthRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  arrowBtn:         { padding: 8 },
  arrow:            { color: t.accent, fontSize: 28, lineHeight: 30 },
  monthLabel:       { color: t.text, fontSize: 17, fontWeight: '600' },
  dayRow:           { flexDirection: 'row', marginBottom: 6 },
  dayLabel:         { flex: 1, textAlign: 'center', color: t.text3, fontSize: 12, fontWeight: '600' },
  grid:             { flexDirection: 'row', flexWrap: 'wrap' },
  cell:             { width: '14.2857%', alignItems: 'center', paddingVertical: 2 },
  cellTop:          { flexDirection: 'row', alignItems: 'center', gap: 1 },
  dayWrap:          { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todayWrap:        { backgroundColor: t.accent },
  dayNum:           { color: t.text2, fontSize: 13 },
  todayNum:         { color: t.text, fontWeight: '700', fontSize: 13 },
  gymDot:           { fontSize: 9 },
  dotRow:           { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot:              { width: 5, height: 5, borderRadius: 3 },
  emptyText:        { color: t.text4, fontSize: 14, textAlign: 'center', marginTop: 60 },
  eventCard:        { backgroundColor: t.surface2, borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderLeftWidth: 3, gap: 10, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  eventTitle:       { color: t.text, fontSize: 14, fontWeight: '600' },
  eventTime:        { color: t.text2, fontSize: 12, marginTop: 3 },
  eventNotes:       { color: t.text3, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  deleteIcon:       { color: t.danger, fontSize: 20, lineHeight: 22 },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:            { backgroundColor: t.surface2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor },
  modalTitle:       { color: t.text, fontSize: 16, fontWeight: '700', marginBottom: 16, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
  input:            { backgroundColor: t.border2, color: t.text, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  recRow:           { flexDirection: 'row', gap: 8, marginBottom: 10 },
  recBtn:           { flex: 1, borderRadius: 8, padding: 9, alignItems: 'center', backgroundColor: t.border2 },
  recBtnActive:     { backgroundColor: t.accent },
  recBtnText:       { color: t.text3, fontSize: 13, fontWeight: '600' },
  recBtnTextActive: { color: t.text },
  daySelector:      { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dayToggle:        { flex: 1, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: t.border2 },
  dayToggleActive:  { backgroundColor: t.accent },
  dayToggleText:    { color: t.text3, fontSize: 12, fontWeight: '700' },
  dayToggleTextActive: { color: t.text },
  timeRow:          { flexDirection: 'row', gap: 10, marginBottom: 0 },
  colorRow:         { flexDirection: 'row', gap: 12, marginBottom: 10, marginTop: 4 },
  colorDot:         { width: 28, height: 28, borderRadius: 14 },
  colorDotActive:   { borderWidth: 3, borderColor: t.text },
  modalBtns:        { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn:              { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  btnCancel:        { backgroundColor: t.border2 },
  btnCancelText:    { color: t.text2, fontWeight: '600', fontFamily: t.fontTitle },
  btnSave:          { backgroundColor: t.accent },
  btnSaveText:      { color: t.cartoon ? t.bg : t.text, fontWeight: '700', fontFamily: t.fontTitle },
})
