import { useState, useEffect, useCallback } from 'react'
import {
  View, ScrollView, TouchableOpacity,
  Modal, StyleSheet, Alert, useWindowDimensions,
} from 'react-native'
import Text from '../components/Text'
import TextInput from '../components/TextInput'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'
import FadeInView from '../components/FadeInView'
import CartoonEntrance from '../components/CartoonEntrance'
import HabitCheck from '../components/HabitCheck'
import { titleShadow } from '../cartoonStyles'
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
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

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

const CELL_H      = 36
const NAME_W      = 100
const PCT_W       = 38
const GRID_MARGIN = 14   // separación lateral de la tabla respecto a los bordes de pantalla

export default function HabitsScreen() {
  const { theme: t } = useTheme()
  const { t: tr }    = useLang()
  const insets       = useSafeAreaInsets()
  const { width: screenW } = useWindowDimensions()

  // 7 celdas de día encajan en el ancho disponible (descontando margen lateral + borde del contenedor)
  const weekCellW = Math.floor((screenW - GRID_MARGIN * 2 - 2 - NAME_W - PCT_W * 2) / 7)

  const now = new Date()
  const [cursor, setCursor]       = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [categories, setCategories] = useState([])
  const [habits, setHabits]       = useState([])
  const [logs, setLogs]           = useState([])
  const [activeCatId, setActiveCatId] = useState(null)
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [viewMode, setViewMode]   = useState('week')   // 'week' | 'month'
  const [weekCenter, setWeekCenter] = useState(4)       // día central de la ventana de 7

  const year     = cursor.getFullYear()
  const month    = cursor.getMonth()
  const days     = daysInMonth(year, month)
  const monthStr = toMonthStr(cursor)
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate())

  // Centrar la ventana en hoy (o en el centro del mes si es otro mes)
  useEffect(() => {
    const todayInThis = year === now.getFullYear() && month === now.getMonth()
    const center = todayInThis ? now.getDate() : Math.ceil(days / 2)
    setWeekCenter(Math.max(4, Math.min(center, days - 3)))
  }, [year, month, days])

  // ── Data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const [cats, habs, ls] = await Promise.all([
        getHabitCategories(), getHabits(), getHabitLogs(monthStr),
      ])
      setCategories(cats)
      setHabits(habs)
      setLogs(ls)
      if (cats.length > 0) setActiveCatId(id => id ?? cats[0].id)
    } catch (err) { console.error('Habits load error:', err) }
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
      const sidToLid  = Object.fromEntries(localCats.filter(c => c.server_id).map(c => [c.server_id, c.id]))
      for (const h of serverHabits) {
        const localCatId = sidToLid[h.category_id]
        if (localCatId) await upsertHabitFromServer(h, localCatId)
      }
      await pruneStaleHabits(new Set(serverHabits.map(h => h.id)))

      const localHabits   = await getHabits()
      const hsidToLid     = Object.fromEntries(localHabits.filter(h => h.server_id).map(h => [h.server_id, h.id]))
      for (const l of serverLogs) {
        const localHabitId = hsidToLid[l.habit_id]
        if (localHabitId) await upsertHabitLogFromServer(l, localHabitId)
      }
      await pruneStaleHabitLogs(new Set(serverLogs.map(l => l.id)))
    } catch (e) {
      console.warn('habits sync failed:', e)
    }
    finally { syncingHabits = false; await load() }
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
    return dow.includes((new Date(year, month, day).getDay() + 6) % 7)
  }
  function expectedDaysInMonth(habit) {
    const dow = parseDow(habit.days_of_week)
    let n = 0
    for (let d = 1; d <= days; d++) {
      if (dow.includes((new Date(year, month, d).getDay() + 6) % 7)) n++
    }
    return n
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
    const exp = expectedDaysInMonth(habit)
    return exp === 0 ? 0 : Math.round((completedExpected(habitId, habit) / exp) * 100)
  }
  function overallPct() {
    if (visibleHabits.length === 0) return 0
    return Math.round(visibleHabits.reduce((acc, h) => acc + pct(h.id, h), 0) / visibleHabits.length)
  }

  const rate = overallPct()

  // Ventana de 7 días centrada en weekCenter
  const weekDayNums = Array.from({ length: 7 }, (_, i) => weekCenter - 3 + i)
  function shiftWeek(delta) {
    setWeekCenter(c => Math.max(4, Math.min(c + delta, days - 3)))
  }

  async function handleToggle(habitId, day) {
    if (toDateStr(year, month, day) > todayStr) return
    await toggleHabitLog(habitId, toDateStr(year, month, day))
    await load(); sync()
  }

  // ── Modals ────────────────────────────────────────────────────────────────

  function openCreateCat() { setForm({ name: '', color: CATEGORY_COLORS[0] }); setModal({ type: 'cat', mode: 'create' }) }
  function openEditCat(cat) { setForm({ name: cat.name, color: cat.color }); setModal({ type: 'cat', mode: 'edit', data: cat }) }
  async function handleSaveCat() {
    if (!form.name.trim()) return
    if (modal.mode === 'create') await insertHabitCategory({ name: form.name.trim(), color: form.color })
    else await updateHabitCategory(modal.data.id, { name: form.name.trim(), color: form.color })
    setModal(null); await load(); sync()
  }
  function handleDeleteCat() {
    Alert.alert(tr('habits.editCategory'), `Delete "${modal.data.name}"?`, [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('common.delete'), style: 'destructive', onPress: async () => {
        await deleteLocalHabitCategory(modal.data.id); setActiveCatId(null); setModal(null); await load(); sync()
      }},
    ])
  }

  function openCreateHabit() { setForm({ name: '', dow: [0,1,2,3,4,5,6] }); setModal({ type: 'habit', mode: 'create' }) }
  function openEditHabit(habit) { setForm({ name: habit.name, dow: parseDow(habit.days_of_week) }); setModal({ type: 'habit', mode: 'edit', data: habit }) }
  function toggleFormDay(d) {
    setForm(f => ({ ...f, dow: f.dow.includes(d) ? f.dow.filter(x => x !== d) : [...f.dow, d].sort((a,b) => a-b) }))
  }
  async function handleSaveHabit() {
    if (!form.name.trim() || form.dow.length === 0) return
    const dowStr = form.dow.sort((a,b) => a-b).join(',')
    if (modal.mode === 'create') {
      const catHabits = habits.filter(h => h.local_category_id === activeCatId)
      await insertHabit({ local_category_id: activeCatId, name: form.name.trim(), days_of_week: dowStr, position: catHabits.length })
    } else {
      await updateHabit(modal.data.id, { name: form.name.trim(), days_of_week: dowStr, position: modal.data.position })
    }
    setModal(null); await load(); sync()
  }
  function handleDeleteHabit() {
    Alert.alert(tr('habits.editHabit'), `Delete "${modal.data.name}"?`, [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('common.delete'), style: 'destructive', onPress: async () => {
        await deleteLocalHabit(modal.data.id); setModal(null); await load(); sync()
      }},
    ])
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const s = makeStyles(t)
  const monthLabel = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())

  // Etiqueta de la ventana de 7 días
  const weekStart = weekDayNums[0]
  const weekEnd   = weekDayNums[6]
  const weekLabel = `${weekStart}–${weekEnd} ${cursor.toLocaleDateString('es-ES', { month: 'short' })}`

  function renderDayHeader(dayNum, cellW, isLast) {
    const ds     = toDateStr(year, month, dayNum)
    const dow    = (new Date(year, month, dayNum).getDay() + 6) % 7
    const isWkd  = dow === 5 || dow === 6
    const isTod  = ds === todayStr
    return (
      <View key={dayNum} style={[s.dayCol, { width: cellW }, isWkd && s.weekend, isTod && s.todayCol, isLast && s.noRightBorder]}>
        <Text style={[s.dayNum, isTod && { color: t.accent, fontWeight: '800' }]}>{dayNum}</Text>
        <Text style={[s.dayDow, isTod && { color: t.accent }]}>{DAY_LABELS[dow]}</Text>
      </View>
    )
  }

  function renderDayCell(habit, dayNum, cellW, isLast) {
    const ds     = toDateStr(year, month, dayNum)
    const done   = isDone(habit.id, dayNum)
    const skip   = !isExpected(habit, dayNum)
    const future = ds > todayStr
    const dow    = (new Date(year, month, dayNum).getDay() + 6) % 7
    const isWkd  = dow === 5 || dow === 6
    const isTod  = ds === todayStr
    return (
      <TouchableOpacity
        key={dayNum}
        style={[
          s.dayCell, { width: cellW },
          isWkd  && s.weekend,
          skip   && s.skipCell,
          done   && { backgroundColor: t.accentLight },
          isLast && s.noRightBorder,
        ]}
        onPress={() => !skip && !future && handleToggle(habit.id, dayNum)}
        activeOpacity={skip || future ? 1 : 0.65}
      >
        {isTod && <View style={s.todayWash} pointerEvents="none" />}
        <HabitCheck done={done} t={t} />
      </TouchableOpacity>
    )
  }

  function renderGrid(dayList, cellW) {
    const lastDay = dayList.length - 1
    return (
      <View style={s.gridWrap}>
        {/* Header */}
        <View style={s.gridRow}>
          <View style={s.nameCol}><Text style={s.headerText}>Habit</Text></View>
          {dayList.map((d, i) => renderDayHeader(d, cellW, i === lastDay))}
          <View style={[s.pctCol, s.pctSep]}><Text style={s.headerText}>%</Text></View>
          <View style={s.pctCol}><Text style={s.headerText}>/{days}</Text></View>
        </View>
        {/* Rows */}
        {visibleHabits.map((habit, idx) => {
          const p        = pct(habit.id, habit)
          const pctColor = p >= 80 ? '#4ade80' : p >= 50 ? '#fbbf24' : t.text4
          const isLastRow = idx === visibleHabits.length - 1
          return (
            <View key={habit.id} style={[s.gridRow, idx % 2 === 1 && s.rowAlt, isLastRow && s.rowLast]}>
              <View style={s.nameCol}>
                <Text style={s.habitName} numberOfLines={1}>{habit.name}</Text>
                <TouchableOpacity style={s.editBtn} onPress={() => openEditHabit(habit)} hitSlop={8}>
                  <Text style={s.editBtnText}>✎</Text>
                </TouchableOpacity>
              </View>
              {dayList.map((d, i) => renderDayCell(habit, d, cellW, i === lastDay))}
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
    )
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

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

        {/* Controls bar */}
        {activeCat && (
          <View style={s.controlBar}>
            {/* Mes nav (solo visible en modo mes) o ventana semanal */}
            {viewMode === 'month' ? (
              <View style={s.monthNav}>
                <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))} style={s.arrowBtn}>
                  <Text style={s.arrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={s.monthLabel}>{monthLabel}</Text>
                <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))} style={s.arrowBtn}>
                  <Text style={s.arrowText}>›</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.monthNav}>
                <TouchableOpacity onPress={() => shiftWeek(-1)} style={s.arrowBtn}>
                  <Text style={s.arrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={s.monthLabel}>{weekLabel}</Text>
                <TouchableOpacity onPress={() => shiftWeek(1)} style={s.arrowBtn}>
                  <Text style={s.arrowText}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* Badge de tasa */}
              {visibleHabits.length > 0 && (
                <View style={[s.rateBadge, rate >= 80 ? s.rateGood : rate >= 50 ? s.rateMid : s.rateBad]}>
                  <Text style={[s.rateText, { color: rate >= 80 ? '#4ade80' : rate >= 50 ? '#fbbf24' : '#f87171' }]}>
                    {rate}%
                  </Text>
                </View>
              )}
              {/* Toggle semana/mes */}
              <TouchableOpacity
                style={s.viewToggle}
                onPress={() => setViewMode(m => m === 'week' ? 'month' : 'week')}
              >
                <Text style={s.viewToggleText}>{viewMode === 'week' ? '📅 Mes' : '7 días'}</Text>
              </TouchableOpacity>
              {/* Editar categoría */}
              <TouchableOpacity style={s.btnIcon} onPress={() => openEditCat(activeCat)}>
                <Text style={{ color: t.accent, fontSize: 16 }}>✎</Text>
              </TouchableOpacity>
              {/* Añadir hábito */}
              <TouchableOpacity style={s.btnPrimary} onPress={openCreateHabit}>
                <Text style={s.btnPrimaryText}>{tr('habits.addHabit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Grid */}
        {activeCat && visibleHabits.length === 0 && (
          <Text style={s.hint}>{tr('habits.noHabits')}</Text>
        )}

        {activeCat && visibleHabits.length > 0 && (
          viewMode === 'week'
            ? /* Vista 7 días — sin scroll horizontal, cabe en pantalla */
              <CartoonEntrance type="drop" style={{ marginTop: 8 }}>
                {renderGrid(weekDayNums, weekCellW)}
              </CartoonEntrance>
            : /* Vista mes completo — scroll horizontal */
              <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 8 }}>
                {renderGrid(Array.from({ length: days }, (_, i) => i + 1), 32)}
              </ScrollView>
        )}

        {categories.length === 0 && (
          <Text style={s.hint}>{tr('habits.noCategories')}</Text>
        )}
      </ScrollView>

      {/* Modal categoría */}
      <Modal visible={modal?.type === 'cat'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{modal?.mode === 'create' ? tr('habits.newCategory') : tr('habits.editCategory')}</Text>
            <TextInput
              style={s.input} placeholder={tr('habits.categoryName')} placeholderTextColor={t.text3}
              value={form.name ?? ''} onChangeText={v => setForm(f => ({ ...f, name: v }))} autoFocus
            />
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>{tr('habits.color')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {CATEGORY_COLORS.map(c => (
                <TouchableOpacity key={c}
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

      {/* Modal hábito */}
      <Modal visible={modal?.type === 'habit'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{modal?.mode === 'create' ? tr('habits.newHabit') : tr('habits.editHabit')}</Text>
            <TextInput
              style={s.input} placeholder={tr('habits.habitName')} placeholderTextColor={t.text3}
              value={form.name ?? ''} onChangeText={v => setForm(f => ({ ...f, name: v }))} autoFocus
            />
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>{tr('habits.daysOfWeek')}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {DAY_LABELS.map((label, i) => (
                <TouchableOpacity key={i}
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

function makeStyles(t) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingBottom: 12,
    },
    title:      { fontSize: 26, fontWeight: '700', color: t.cartoon ? t.accent : t.text, fontFamily: t.fontTitle, textTransform: t.cartoon ? 'uppercase' : 'none', ...titleShadow(t) },
    tabsRow:    { marginBottom: 4 },
    catTab: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    catDot:     { width: 8, height: 8, borderRadius: 4 },
    catTabText: { fontSize: 13, fontWeight: '500', color: t.text2 },

    controlBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 8,
    },
    monthNav:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    monthLabel: { fontSize: 13, fontWeight: '600', color: t.text2 },
    arrowBtn:   { padding: 4 },
    arrowText:  { fontSize: 20, color: t.text2 },

    rateBadge:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    rateGood:   { backgroundColor: '#14532d22' },
    rateMid:    { backgroundColor: '#78350f22' },
    rateBad:    { backgroundColor: '#7f1d1d22' },
    rateText:   { fontSize: 11, fontWeight: '700' },

    viewToggle: {
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 8, backgroundColor: t.surface2,
      borderWidth: 1, borderColor: t.border2,
    },
    viewToggleText: { fontSize: 12, fontWeight: '600', color: t.text2 },

    hint: { color: t.text3, textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },

    // Grid
    gridWrap: {
      marginHorizontal: GRID_MARGIN,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: t.surface,
    },
    gridRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.text4 },
    rowAlt:        { backgroundColor: 'rgba(255,255,255,0.02)' },
    rowLast:       { borderBottomWidth: 0 },
    noRightBorder: { borderRightWidth: 0 },
    nameCol: {
      width: NAME_W, height: CELL_H, paddingLeft: 10, paddingRight: 4,
      flexDirection: 'row', alignItems: 'center', gap: 2,
      borderRightWidth: 2, borderRightColor: t.text3, backgroundColor: t.surface,
    },
    headerText: { fontSize: 9, fontWeight: '700', color: t.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
    habitName:  { flex: 1, fontSize: 12, fontWeight: '500', color: t.text2 },
    editBtn:    { paddingHorizontal: 3, paddingVertical: 2 },
    editBtnText:{ fontSize: 12, color: t.accent },
    dayCol: {
      height: CELL_H, alignItems: 'center', justifyContent: 'center',
      borderRightWidth: 1, borderRightColor: t.border2, backgroundColor: t.surface,
    },
    todayCol:   {},
    weekend:    { backgroundColor: 'rgba(255,255,255,0.025)' },
    dayNum:     { fontSize: 11, fontWeight: '600', color: t.text3, lineHeight: 14 },
    dayDow:     { fontSize: 9,  color: t.text4, lineHeight: 12, textTransform: 'uppercase' },
    dayCell: {
      height: CELL_H, alignItems: 'center', justifyContent: 'center',
      borderRightWidth: 1, borderRightColor: t.border2,
    },
    skipCell:   { backgroundColor: 'rgba(0,0,0,0.12)' },
    todayWash:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.accent, opacity: 0.16 },
    pctCol: {
      width: PCT_W, height: CELL_H, alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.surface,
    },
    pctSep:     { borderLeftWidth: 2, borderLeftColor: t.text3 },
    pctText:    { fontSize: 11, fontWeight: '700' },

    // Modals
    overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: {
      backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 36,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: t.text, marginBottom: 16 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: t.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: t.surface2, color: t.text, borderRadius: 10,
      borderWidth: 1, borderColor: t.border2, padding: 12, fontSize: 15,
    },
    colorDot:       { width: 28, height: 28, borderRadius: 14 },
    colorDotActive: { borderWidth: 3, borderColor: t.text },
    dowBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.surface2,
      borderWidth: 1, borderColor: t.border2,
    },
    dowBtnText:     { fontSize: 12, fontWeight: '700', color: t.text3 },
    modalActions:   { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
    btnPrimary:     { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnCancel:      { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    btnCancelText:  { color: t.text2, fontWeight: '600', fontSize: 13 },
    btnIcon:        { padding: 6 },
    btnDanger:      { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#7f1d1d33', marginRight: 'auto' },
    btnDangerText:  { color: '#f87171', fontWeight: '700', fontSize: 13 },
  })
}
