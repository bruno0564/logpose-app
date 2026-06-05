import { useState, useEffect } from 'react'
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native'
import Text from './Text'
import { useTheme } from '../ThemeContext'

/**
 * Selector de fecha propio, con el estilo de la app (en vez del calendario
 * nativo de Android, que no se puede reestilar). Modal con rejilla mensual
 * navegable; al tocar un día devuelve 'YYYY-MM-DD'.
 *
 * Props: visible, value ('YYYY-MM-DD' | ''), onSelect(dateStr), onClose()
 */
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const pad = n => String(n).padStart(2, '0')
const toStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

export default function DatePicker({ visible, value, onSelect, onClose }) {
  const { theme: t } = useTheme()
  const base = () => (value ? new Date(value + 'T12:00:00') : new Date())
  const [cursor, setCursor] = useState(() => { const d = base(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  useEffect(() => {
    if (visible) { const d = base(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }
  }, [visible])

  const year  = cursor.getFullYear()
  const month = cursor.getMonth()
  const days  = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7   // lunes primero
  const now = new Date()
  const todayStr = toStr(now.getFullYear(), now.getMonth(), now.getDate())

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  const monthLabel = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())

  const s = makeStyles(t)
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.card}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10}>
              <Text style={s.arrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={10}>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={s.weekRow}>
            {WD.map((w, i) => <Text key={i} style={s.weekday}>{w}</Text>)}
          </View>

          <View style={s.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={s.cell} />
              const ds    = toStr(year, month, d)
              const sel   = ds === value
              const today = ds === todayStr
              return (
                <TouchableOpacity key={i} style={s.cell} onPress={() => { onSelect(ds); onClose() }}>
                  <View style={[s.dayInner, today && s.todayInner, sel && s.selInner]}>
                    <Text style={[s.dayText, today && { color: t.accent }, sel && s.selText]}>{d}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function makeStyles(t) {
  return StyleSheet.create({
    overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: {
      width: '100%', maxWidth: 360, backgroundColor: t.surface, borderRadius: 16, padding: 16,
      borderWidth: t.cartoon ? t.cardBorderWidth : 1, borderColor: t.cartoon ? t.cardBorderColor : t.border,
    },
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
    arrow:      { fontSize: 26, color: t.accent, lineHeight: 28 },
    monthLabel: { fontSize: 16, fontWeight: '700', color: t.text, fontFamily: t.fontTitle },
    weekRow:    { flexDirection: 'row', marginBottom: 6 },
    weekday:    { width: `${100 / 7}%`, textAlign: 'center', color: t.text3, fontSize: 11, fontWeight: '700' },
    grid:       { flexDirection: 'row', flexWrap: 'wrap' },
    cell:       { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    dayInner:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    todayInner: { borderWidth: 1, borderColor: t.accent },
    selInner:   { backgroundColor: t.accent },
    dayText:    { color: t.text2, fontSize: 14 },
    selText:    { color: '#fff', fontWeight: '700' },
  })
}
