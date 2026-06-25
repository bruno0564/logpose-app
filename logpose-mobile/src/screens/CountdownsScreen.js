import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, TouchableOpacity, ScrollView,
  Modal, StyleSheet,
} from 'react-native'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import { Ionicons } from '@expo/vector-icons'
import PressableScale from '../components/PressableScale'
import FadeInView from '../components/FadeInView'
import DatePicker from '../components/DatePicker'
import { titleShadow } from '../cartoonStyles'
import GradientButton from '../components/GradientButton'
import {
  getCountdowns, insertLocalCountdown, updateLocalCountdown, deleteLocalCountdown,
  getUnsyncedCountdowns, getPendingDeleteCountdowns,
  markCountdownSynced, upsertCountdownFromServer, purgeLocalCountdown, pruneStaleCountdowns,
} from '../db/database'
import {
  isServerReachable,
  fetchAllCountdownsFromServer, postCountdownToServer, putCountdownToServer, deleteCountdownFromServer,
} from '../api/client'
import { countdownState, countdownLabel, countdownSortKey } from '../countdown'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

let syncingCountdowns = false

function todayStr() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function CountdownsScreen() {
  const { theme: t } = useTheme()
  const { t: tr, tp } = useLang()
  const s = makeStyles(t)
  const [countdowns, setCountdowns] = useState([])
  const [editing, setEditing] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [form, setForm] = useState({ title: '', target_date: todayStr(), is_recurring: false })

  const loadCountdowns = useCallback(async () => {
    setCountdowns(await getCountdowns())
  }, [])

  const sync = useCallback(async () => {
    if (syncingCountdowns) return
    syncingCountdowns = true
    try {
      if (!await isServerReachable()) return
      for (const c of await getUnsyncedCountdowns()) {
        if (c.server_id) {
          await putCountdownToServer(c.server_id, c)
          await markCountdownSynced(c.id, c.server_id)
        } else {
          const created = await postCountdownToServer(c)
          await markCountdownSynced(c.id, created.id)
        }
      }
      for (const c of await getPendingDeleteCountdowns()) {
        await deleteCountdownFromServer(c.server_id)
        await purgeLocalCountdown(c.id)
      }
      const serverItems = await fetchAllCountdownsFromServer()
      for (const c of serverItems) await upsertCountdownFromServer(c)
      await pruneStaleCountdowns(new Set(serverItems.map(c => c.id)))
    } catch (e) { console.warn('countdowns sync failed:', e) } finally {
      syncingCountdowns = false
      await loadCountdowns()
    }
  }, [loadCountdowns])

  useFocusEffect(
    useCallback(() => {
      loadCountdowns().then(() => sync())
    }, [loadCountdowns, sync])
  )

  function openAdd() {
    setForm({ title: '', target_date: todayStr(), is_recurring: false })
    setEditing('new')
  }

  function openEdit(c) {
    setForm({ title: c.title, target_date: c.target_date, is_recurring: !!c.is_recurring })
    setEditing(c)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.target_date) return
    const title = form.title.trim()
    if (editing === 'new') {
      await insertLocalCountdown(title, form.target_date, form.is_recurring)
    } else {
      await updateLocalCountdown(editing.id, title, form.target_date, form.is_recurring)
    }
    setEditing(null)
    await loadCountdowns()
    sync()
  }

  function handleDelete(c) {
    setConfirmTarget(c)
  }

  async function confirmDelete() {
    const c = confirmTarget
    setConfirmTarget(null)
    await deleteLocalCountdown(c.id)
    await loadCountdowns()
    sync()
  }

  const sorted = [...countdowns].sort(
    (a, b) => countdownSortKey(a.target_date, a.is_recurring) - countdownSortKey(b.target_date, b.is_recurring)
  )

  return (
    <FadeInView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{tr('countdowns.title')}</Text>
        <PressableScale style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+</Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {countdowns.length === 0 && (
          <Text style={s.emptyText}>{tr('countdowns.noCountdownsMobile')}</Text>
        )}
        {sorted.map(c => {
          const st = countdownState(c.target_date, c.is_recurring)
          const valueColor = st.direction === 'past' ? t.text3 : st.direction === 'today' ? t.success : t.accent
          return (
            <View key={c.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{c.title}</Text>
                <View style={s.metaRow}>
                  <Text style={s.metaText}>{c.target_date}</Text>
                  {c.is_recurring ? <Text style={s.tag}>{tr('countdowns.recurringTag')}</Text> : null}
                </View>
              </View>
              <Text style={[s.value, { color: valueColor }]}>{countdownLabel(st, tr, tp)}</Text>
              <View style={s.actions}>
                <TouchableOpacity onPress={() => openEdit(c)} hitSlop={10} style={s.actionBtn}>
                  <Ionicons name="pencil" size={15} color={t.text3} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(c)} hitSlop={10} style={s.actionBtn}>
                  <Text style={s.deleteIcon}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              {editing === 'new' ? tr('countdowns.newCountdown') : tr('countdowns.editCountdown')}
            </Text>
            <TextInput
              style={s.input}
              placeholder={tr('countdowns.titlePh')}
              placeholderTextColor={t.text3}
              autoFocus
              value={form.title}
              onChangeText={v => setForm(f => ({ ...f, title: v }))}
            />
            <TouchableOpacity style={s.datePicker} onPress={() => setShowPicker(true)}>
              <Text style={s.datePickerText}>{form.target_date}</Text>
              <Ionicons name="calendar-outline" size={16} color={t.text3} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.toggleRow}
              onPress={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
              activeOpacity={0.7}
            >
              <Ionicons
                name={form.is_recurring ? 'checkbox' : 'square-outline'}
                size={20}
                color={form.is_recurring ? t.accent : t.text3}
              />
              <Text style={s.toggleText}>{tr('countdowns.recurring')}</Text>
            </TouchableOpacity>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setEditing(null)}>
                <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <GradientButton onPress={handleSave} label={tr('common.save')} />
            </View>
          </View>
        </View>
      </Modal>

      <DatePicker
        visible={showPicker}
        value={form.target_date}
        onClose={() => setShowPicker(false)}
        onSelect={d => setForm(f => ({ ...f, target_date: d }))}
      />

      <Modal visible={confirmTarget !== null} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setConfirmTarget(null)}>
          <TouchableOpacity activeOpacity={1} style={[s.modal, { borderRadius: 16 }]}>
            <Text style={s.modalTitle}>{tr('countdowns.deleteCountdown')}</Text>
            <Text style={{ color: t.text2, fontSize: 14, marginBottom: 4 }}>{tr('countdowns.deleteConfirm')}</Text>
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
  card:         { backgroundColor: t.surface2, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor, ...(t.cartoon ? t.shadow : {}) },
  cardTitle:    { color: t.text, fontSize: 15, fontWeight: '600' },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText:     { color: t.text3, fontSize: 12 },
  tag:          { color: t.accent, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, borderWidth: 1, borderColor: t.accent, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  value:        { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  actions:      { flexDirection: 'column', gap: 8, alignItems: 'center' },
  actionBtn:    { padding: 4 },
  deleteIcon:   { color: t.danger, fontSize: 18, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: t.surface2, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 44, gap: 12, borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.cardBorderColor },
  modalTitle:   { color: t.text, fontSize: 16, fontWeight: '700', marginBottom: 4, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none' },
  input:        { backgroundColor: t.border2, color: t.text, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  datePicker:   { backgroundColor: t.border2, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: t.cartoon ? 2 : 0, borderColor: t.text },
  datePickerText: { color: t.text, fontSize: 15 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  toggleText:   { color: t.text2, fontSize: 14 },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn:          { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
  btnCancel:    { backgroundColor: t.border2 },
  btnCancelText:{ color: t.text2, fontWeight: '600', fontFamily: t.fontTitle },
  btnSaveText:  { color: t.cartoon ? t.bg : t.text, fontWeight: '700', fontFamily: t.fontTitle },
})
