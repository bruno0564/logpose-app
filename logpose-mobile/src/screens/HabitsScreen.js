import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'
import FadeInView from '../components/FadeInView'
import {
  getHabitCategories, insertHabitCategory, updateHabitCategory, deleteLocalHabitCategory,
  getHabits, insertHabit, updateHabit, deleteLocalHabit,
  getHabitLogs, toggleHabitLog,
  getUnsyncedHabitCategories, getPendingDeleteHabitCategories, markHabitCategorySynced, purgeLocalHabitCategory, upsertHabitCategoryFromServer, pruneStaleHabitCategories,
  getUnsyncedHabits, getPendingDeleteHabits, markHabitSynced, purgeLocalHabit, upsertHabitFromServer, pruneStaleHabits,
  getUnsyncedHabitLogs, getPendingDeleteHabitLogs, markHabitLogSynced, purgeLocalHabitLog, upsertHabitLogFromServer, pruneStaleHabitLogs,
} from '../db/database'
import {
  isServerReachable,
  fetchAllHabitCategoriesFromServer, postHabitCategoryToServer, putHabitCategoryToServer, deleteHabitCategoryFromServer,
  fetchAllHabitsFromServer, postHabitToServer, putHabitToServer, deleteHabitFromServer,
  fetchHabitLogsFromServer, postHabitLogToServer, deleteHabitLogFromServer,
} from '../api/client'

const CATEGORY_COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#ea580c', '#dc2626', '#0891b2', '#d97706', '#ec4899']
const DAY_LABELS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

let syncingHabits = false

function toMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function parseDow(str) {
  return str ? str.split(',').map(Number).filter(n => !isNaN(n)) : [0, 1, 2, 3, 4, 5, 6]
}

export default function HabitsScreen() {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const insets = useSafeAreaInsets()
  const s = makeStyles(t)

  const now = new Date()
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [categories, setCategories] = useState([])
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [activeCatId, setActiveCatId] = useState(null)
  const [modal, setModal] = useState(null) // {type:'cat'|'habit', mode:'create'|'edit', data?}
  const [form, setForm] = useState({})

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const days = daysInMonth(year, month)
  const monthStr = toMonthStr(cursor)
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate())

  const load = useCallback(async () => {
    try {
      const [cats, habs, ls] = await Promise.all([
        getHabitCategories(),
        getHabits(),
        getHabitLogs(monthStr),
      ])
      setCategories(cats)
      setHabits(habs)
      setLogs(ls)
      if (cats.length > 0) setActiveCatId(id => id ?? cats[0].id)
    } catch (err) {
      console.error('Habits load error:', err)
    }
  }, [monthStr])

  const sync = useCallback(async () => {
    if (syncingHabits) return
    syncingHabits = true
    try {
      if (!await isServerReachable()) return

      for (const c of await getUnsyncedHabitCategories()) {
        if (c.server_id) { await putHabitCategoryToServer(c.server_id, c); await markHabitCategorySynced(c.id, c.server_id) }
        else             { const r = await postHabitCategoryToServer(c); await markHabitCategorySynced(c.id, r.id) }
      }
      for (const c of await getPendingDeleteHabitCategories()) {
        await deleteHabitCategoryFromServer(c.server_id); await purgeLocalHabitCategory(c.id)
      }

      for (const h of await getUnsyncedHabits()) {
        if (h.server_id) { await putHabitToServer(h.server_id, h); await markHabitSynced(h.id, h.server_id) }
        else             { const r = await postHabitToServer(h, h.cat_server_id); await markHabitSynced(h.id, r.id) }
      }
      for (const h of await getPendingDeleteHabits()) {
        await deleteHabitFromServer(h.server_id); await purgeLocalHabit(h.id)
      }

      for (const l of await getUnsyncedHabitLogs()) {
        if (l.server_id) { await markHabitLogSynced(l.id, l.server_id) }
        else             { const r = await postHabitLogToServer(l, l.habit_server_id); await markHabitLogSynced(l.id, r.id) }
      }
      for (const l of await getPendingDeleteHabitLogs()) {
        await deleteHabitLogFromServer(l.server_id); await purgeLocalHabitLog(l.id)
      }

      const serverCats   = await fetchAllHabitCategoriesFromServer()
      const serverHabits = await fetchAllHabitsFromServer()
      const serverLogs   = await fetchHabitLogsFromServer(monthStr)

      for (const c of serverCats) await upsertHabitCategoryFromServer(c)
      await pruneStaleHabitCategories(new Set(serverCats.map(c => c.id)))

      const localCats = await getHabitCategories()
      const serverIdToLocalId = Object.fromEntries(localCats.filter(c => c.server_id).map(c => [c.server_id, c.id]))
      for (const h of serverHabits) {
        const localCatId = serverIdToLocalId[h.category_id]
        if (localCatId) await upsertHabitFromServer(h, localCatId)
      }
      await pruneStaleHabits(new Set(serverHabits.map(h => h.id)))

      const localHabits = await getHabits()
      const habitServerIdToLocalId = Object.fromEntries(localHabits.filter(h => h.server_id).map(h => [h.server_id, h.id]))
      for (const l of serverLogs) {
        const localHabitId = habitServerIdToLocalId[l.habit_id]
        if (localHabitId) await upsertHabitLogFromServer(l, localHabitId)
      }
      await pruneStaleHabitLogs(new Set(serverLogs.map(l => l.id)))
    } catch {}
    finally {
      syncingHabits = false
      await load()
    }
  }, [load, monthStr])

  useFocusEffect(useCallback(() => { load().then(() => sync()) }, [monthStr]))

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeCat     = categories.find(c => c.id === activeCatId)
  const visibleHabits = habits.filter(h => h.local_category_id === activeCatId)
  const logSet        = new Set(logs.filter(l => !l.pending_delete).map(l => `${l.local_habit_id}-${l.date}`))

  function isDone(habitId, day) {
    return logSet.has(`${habitId}-${toDateStr(year, month, day)}`)
  }
  function isExpected(habit, day) {
    const dow = parseDow(habit.days_of_week)
    const d   = (new Date(year, month, day).getDay() + 6) % 7
    return dow.includes(d)
  }
  function expectedDaysInMonth(habit) {
    const dow = parseDow(habit.days_of_week)
    let count = 0
    for (let d = 1; d <= days; d++) {
      if (dow.includes((new Date(year, month, d).getDay() + 6) % 7)) count++
    }
    return count
  }
  function completedExpected(habitId, habit) {
    const dow = parseDow(habit.days_of_week)
    return logs.filter(l => {
      if (l.local_habit_id !== habitId || l.pending_delete) return false
      const [, , dd] = l.date.split('-').map(Number)
      return dow.includes((new Date(year, month, dd).getDay() + 6) % 7)
    }).length
  }
  function pct(habitId, habit) {
    const expected = expectedDaysInMonth(habit)
    if (expected === 0) return 0
    return Math.round((completedExpected(habitId, habit) / expected) * 100)
  }
  function overallPct() {
    if (visibleHabits.length === 0) return 0
    return Math.round(visibleHabits.reduce((acc, h) => acc + pct(h.id, h), 0) / visibleHabits.length)
  }

  const rate = overallPct()
  const rateLabel = rate >= 80 ? tr('habits.onFire') : rate >= 50 ? tr('habits.keepGoing') : tr('habits.needsWork')

  async function handleToggle(habitId, day) {
    if (toDateStr(year, month, day) > todayStr) return
    await toggleHabitLog(habitId, toDateStr(year, month, day))
    await load()
    sync()
  }

  // ── Category modal ────────────────────────────────────────────────────────

  function openCreateCat() {
    setForm({ name: '', color: CATEGORY_COLORS[0] })
    setModal({ type: 'cat', mode: 'create' })
  }
  function openEditCat(cat) {
    setForm({ name: cat.name, color: cat.color })
    setModal({ type: 'cat', mode: 'edit', data: cat })
  }
  async function handleSaveCat() {
    if (!form.name.trim()) return
    if (modal.mode === 'create') {
      await insertHabitCategory({ name: form.name.trim(), color: form.color })
    } else {
      await updateHabitCategory(modal.data.id, { name: form.name.trim(), color: form.color })
    }
    setModal(null)
    await load(); sync()
  }
  function handleDeleteCat() {
    Alert.alert(tr('habits.editCategory'), `Delete "${modal.data.name}"?`, [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('common.delete'), style: 'destructive', onPress: async () => {
        await deleteLocalHabitCategory(modal.data.id)
        setActiveCatId(null)
        setModal(null)
        await load(); sync()
      }},
    ])
  }

  // ── Habit modal ───────────────────────────────────────────────────────────

  function openCreateHabit() {
    setForm({ name: '', dow: [0, 1, 2, 3, 4, 5, 6] })
    setModal({ type: 'habit', mode: 'create' })
  }
  function openEditHabit(habit) {
    setForm({ name: habit.name, dow: parseDow(habit.days_of_week) })
    setModal({ type: 'habit', mode: 'edit', data: habit })
  }
  function toggleFormDay(d) {
    setForm(f => ({
      ...f,
      dow: f.dow.includes(d) ? f.dow.filter(x => x !== d) : [...f.dow, d].sort((a, b) => a - b),
    }))
  }
  async function handleSaveHabit() {
    if (!form.name.trim() || form.dow.length === 0) return
    const dowStr = form.dow.sort((a, b) => a - b).join(',')
    if (modal.mode === 'create') {
      const catHabits = habits.filter(h => h.local_category_id === activeCatId)
      await insertHabit({ local_category_id: activeCatId, name: form.name.trim(), days_of_week: dowStr, position: catHabits.length })
    } else {
      await updateHabit(modal.data.id, { name: form.name.trim(), days_of_week: dowStr, position: modal.data.position })
    }
    setModal(null)
    await load(); sync()
  }
  function handleDeleteHabit() {
    Alert.alert(tr('habits.editHabit'), `Delete "${modal.data.name}"?`, [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('common.delete'), style: 'destructive', onPress: async () => {
        await deleteLocalHabit(modal.data.id)
        setModal(null)
        await load(); sync()
      }},
    ])
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const monthLabel = cursor
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())

  return (
    <FadeInView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Text style={s.title}>{tr('habits.title')}</Text>
          <TouchableOpacity style={s.btnPrimary} onPress={openCreateCat}>
            <Text style={s.btnPrimaryText}>{tr('habits.addCategory')}</Text>
          </TouchableOpacity>
        </View>

        {/* Category tabs */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[s.catTab, activeCatId === cat.id && { borderBottomColor: cat.color, borderBottomWidth: 2 }]}
                onPress={() => setActiveCatId(cat.id)}
              >
                <View style={[s.catDot, { backgroundColor: cat.color }]} />
                <Text style={[s.catTabText, activeCatId === cat.id && { color: cat.color, fontWeight: '700' }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Month nav + rate + actions */}
        {activeCat && (
          <View style={s.monthBar}>
            <View style={s.monthNav}>
              <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))} style={s.arrowBtn}>
                <Text style={s.arrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={s.monthLabel}>{monthLabel}</Text>
              <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))} style={s.arrowBtn}>
                <Text style={s.arrowText}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {visibleHabits.length > 0 && (
                <View style={[s.rateBadge, rate >= 80 ? s.rateGood : rate >= 50 ? s.rateMid : s.rateBad]}>
                  <Text style={[s.rateText, rate >= 80 ? { color: '#4ade80' } : rate >= 50 ? { color: '#fbbf24' } : { color: '#f87171' }]}>
                    {rate}%
                  </Text>
                </View>
              )}
              <TouchableOpacity style={s.btnIcon} onPress={() => openEditCat(activeCat)}>
                <Text style={{ color: t.accent, fontSize: 16 }}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={openCreateHabit}>
                <Text style={s.btnPrimaryText}>{tr('habits.addHabit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Grid (horizontal scroll) */}
        {activeCat && visibleHabits.length === 0 && (
          <Text style={s.hint}>{tr('habits.noHabits')}</Text>
        )}

        {activeCat && visibleHabits.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 8 }}>
            <View>
              {/* Header row */}
              <View style={s.gridRow}>
                <View style={s.nameCol}><Text style={s.headerText}>Habit</Text></View>
                {Array.from({ length: days }, (_, i) => {
                  const ds  = toDateStr(year, month, i + 1)
                  const dow = (new Date(year, month, i + 1).getDay() + 6) % 7
                  const isWkd = dow === 5 || dow === 6
                  const isToday = ds === todayStr
                  return (
                    <View key={i} style={[s.dayCol, isWkd && s.weekend, isToday && s.todayCol]}>
                      <Text style={[s.dayNum, isToday && { color: t.accent }]}>{i + 1}</Text>
                      <Text style={[s.dayDow, isToday && { color: t.accent, opacity: 0.8 }]}>
                        {DAY_LABELS_ES[dow]}
                      </Text>
                    </View>
                  )
                })}
                <View style={[s.pctCol, s.pctSep]}><Text style={s.headerText}>%</Text></View>
                <View style={s.pctCol}><Text style={s.headerText}>/{days}</Text></View>
              </View>

              {/* Habit rows */}
              {visibleHabits.map((habit, rowIdx) => {
                const p        = pct(habit.id, habit)
                const pctColor = p >= 80 ? '#4ade80' : p >= 50 ? '#fbbf24' : t.text4
                return (
                  <View key={habit.id} style={[s.gridRow, rowIdx % 2 === 1 && s.rowAlt]}>
                    <TouchableOpacity style={s.nameCol} onLongPress={() => openEditHabit(habit)} activeOpacity={0.7}>
                      <Text style={s.habitName} numberOfLines={1}>{habit.name}</Text>
                    </TouchableOpacity>
                    {Array.from({ length: days }, (_, i) => {
                      const ds      = toDateStr(year, month, i + 1)
                      const done    = isDone(habit.id, i + 1)
                      const skip    = !isExpected(habit, i + 1)
                      const future  = ds > todayStr
                      const dow     = (new Date(year, month, i + 1).getDay() + 6) % 7
                      const isWkd   = dow === 5 || dow === 6
                      const isToday = ds === todayStr
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[
                            s.dayCell,
                            isWkd  && s.weekend,
                            skip   && s.skipCell,
                            done   && { backgroundColor: t.accentLight },
                            isToday && s.todayCell,
                          ]}
                          onPress={() => !skip && !future && handleToggle(habit.id, i + 1)}
                          activeOpacity={skip || future ? 1 : 0.7}
                        >
                          {done && <View style={[s.check, { backgroundColor: t.accent }]} />}
                        </TouchableOpacity>
                      )
                    })}
                    <View style={[s.pctCol, s.pctSep]}>
                      <Text style={[s.pctText, { color: pctColor }]}>{p}%</Text>
                    </View>
                    <View style={s.pctCol}>
                      <Text style={[s.pctText, { color: pctColor }]}>
                        {completedExpected(habit.id, habit)}/{expectedDaysInMonth(habit)}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </ScrollView>
        )}

        {categories.length === 0 && (
          <Text style={s.hint}>{tr('habits.noCategories')}</Text>
        )}
      </ScrollView>

      {/* Category modal */}
      <Modal visible={modal?.type === 'cat'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{modal?.mode === 'create' ? tr('habits.newCategory') : tr('habits.editCategory')}</Text>
            <TextInput
              style={s.input}
              placeholder={tr('habits.categoryName')}
              placeholderTextColor={t.text3}
              value={form.name ?? ''}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              autoFocus
            />
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>{tr('habits.color')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {CATEGORY_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.colorDot, { backgroundColor: c }, form.color === c && s.colorDotActive]}
                  onPress={() => setForm(f => ({ ...f, color: c }))}
                />
              ))}
            </View>
            <View style={s.modalActions}>
              {modal?.mode === 'edit' && (
                <TouchableOpacity style={s.btnDanger} onPress={handleDeleteCat}>
                  <Text style={s.btnDangerText}>{tr('common.delete')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnCancel} onPress={() => setModal(null)}>
                <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={handleSaveCat}>
                <Text style={s.btnPrimaryText}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Habit modal */}
      <Modal visible={modal?.type === 'habit'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{modal?.mode === 'create' ? tr('habits.newHabit') : tr('habits.editHabit')}</Text>
            <TextInput
              style={s.input}
              placeholder={tr('habits.habitName')}
              placeholderTextColor={t.text3}
              value={form.name ?? ''}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              autoFocus
            />
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>{tr('habits.daysOfWeek')}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {DAY_LABELS_ES.map((label, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.dowBtn, form.dow?.includes(i) && { backgroundColor: t.accent }]}
                  onPress={() => toggleFormDay(i)}
                >
                  <Text style={[s.dowBtnText, form.dow?.includes(i) && { color: '#fff' }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.dow?.length === 0 && (
              <Text style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{tr('habits.atLeastOneDay')}</Text>
            )}
            <View style={s.modalActions}>
              {modal?.mode === 'edit' && (
                <TouchableOpacity style={s.btnDanger} onPress={handleDeleteHabit}>
                  <Text style={s.btnDangerText}>{tr('common.delete')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnCancel} onPress={() => setModal(null)}>
                <Text style={s.btnCancelText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={handleSaveHabit}>
                <Text style={s.btnPrimaryText}>{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </FadeInView>
  )
}

const CELL_W  = 32
const CELL_H  = 34
const NAME_W  = 140
const PCT_W   = 44

function makeStyles(t) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingBottom: 12,
    },
    title: { fontSize: 26, fontWeight: '700', color: t.text, fontFamily: t.fontTitle },
    tabsRow: { marginBottom: 4 },
    catTab: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    catDot: { width: 8, height: 8, borderRadius: 4 },
    catTabText: { fontSize: 13, fontWeight: '500', color: t.text2 },
    monthBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 8,
    },
    monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    monthLabel: { fontSize: 14, fontWeight: '600', color: t.text2 },
    arrowBtn: { padding: 4 },
    arrowText: { fontSize: 20, color: t.text2 },
    rateBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    rateGood: { backgroundColor: '#14532d22' },
    rateMid:  { backgroundColor: '#78350f22' },
    rateBad:  { backgroundColor: '#7f1d1d22' },
    rateText: { fontSize: 12, fontWeight: '700' },
    hint: { color: t.text3, textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },

    // Grid
    gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.border ?? '#2a2a2a' },
    rowAlt:  { backgroundColor: 'rgba(255,255,255,0.018)' },
    nameCol: {
      width: NAME_W, height: CELL_H, paddingHorizontal: 10, justifyContent: 'center',
      borderRightWidth: 2, borderRightColor: t.text3 ?? '#444', backgroundColor: t.surface,
    },
    headerText: { fontSize: 10, fontWeight: '700', color: t.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
    habitName:  { fontSize: 12, fontWeight: '500', color: t.text2 },
    dayCol: {
      width: CELL_W, height: CELL_H, alignItems: 'center', justifyContent: 'center',
      borderRightWidth: 1, borderRightColor: t.border2 ?? '#2a2a2a',
      backgroundColor: t.surface,
    },
    todayCol: {},
    weekend:   { backgroundColor: 'rgba(255,255,255,0.025)' },
    dayNum:    { fontSize: 10, fontWeight: '600', color: t.text3, lineHeight: 13 },
    dayDow:    { fontSize: 8,  color: t.text4, lineHeight: 11, textTransform: 'uppercase' },
    dayCell: {
      width: CELL_W, height: CELL_H, alignItems: 'center', justifyContent: 'center',
      borderRightWidth: 1, borderRightColor: t.border2 ?? '#2a2a2a',
    },
    skipCell:  { backgroundColor: 'rgba(0,0,0,0.12)' },
    todayCell: { borderWidth: 1, borderColor: t.accent },
    check: { width: 14, height: 14, borderRadius: 7 },
    pctCol: {
      width: PCT_W, height: CELL_H, alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.surface,
    },
    pctSep: { borderLeftWidth: 2, borderLeftColor: t.text3 ?? '#444' },
    pctText: { fontSize: 11, fontWeight: '700' },

    // Modals
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: {
      backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 36,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: t.text, marginBottom: 16 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: t.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: t.surface2, color: t.text, borderRadius: 10,
      borderWidth: 1, borderColor: t.border2 ?? '#333', padding: 12, fontSize: 15,
    },
    colorDot: { width: 28, height: 28, borderRadius: 14 },
    colorDotActive: { borderWidth: 3, borderColor: t.text },
    dowBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.surface2,
      borderWidth: 1, borderColor: t.border2 ?? '#333',
    },
    dowBtnText: { fontSize: 12, fontWeight: '700', color: t.text3 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
    btnPrimary: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnCancel: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    btnCancelText: { color: t.text2, fontWeight: '600', fontSize: 13 },
    btnIcon: { padding: 6 },
    btnDanger: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#7f1d1d33', marginRight: 'auto' },
    btnDangerText: { color: '#f87171', fontWeight: '700', fontSize: 13 },
  })
}
