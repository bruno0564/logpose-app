import { useState, useEffect } from 'react'
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import Text from './Text'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

/**
 * Selector de hora propio, con el estilo de la app (en vez del reloj nativo de
 * Android, que no se puede reestilar). Dos columnas desplazables: horas (00–23)
 * y minutos (00–59); al confirmar devuelve 'HH:MM'.
 *
 * Props: visible, value ('HH:MM' | ''), onSelect(timeStr), onClose()
 */
const pad = n => String(n).padStart(2, '0')
const ROW_H = 44
const COL_H = 200

function parseValue(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '')
  if (m) return [Math.min(23, +m[1]), Math.min(59, +m[2])]
  const now = new Date()
  return [now.getHours(), now.getMinutes()]
}

export default function TimePicker({ visible, value, onSelect, onClose }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const [hour, setHour] = useState(0)
  const [minute, setMinute] = useState(0)

  useEffect(() => {
    if (visible) {
      const [h, m] = parseValue(value)
      setHour(h); setMinute(m)
    }
  }, [visible])

  const s = makeStyles(t)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  // Centrar el valor seleccionado dentro de la columna
  const offsetFor = idx => ({ x: 0, y: Math.max(0, idx * ROW_H - (COL_H / 2 - ROW_H / 2)) })

  const Column = ({ data, selected, onPick }) => (
    <ScrollView
      style={s.col}
      showsVerticalScrollIndicator={false}
      contentOffset={offsetFor(selected)}
      contentContainerStyle={{ paddingVertical: COL_H / 2 - ROW_H / 2 }}
    >
      {data.map(n => {
        const sel = n === selected
        return (
          <TouchableOpacity key={n} style={s.row} onPress={() => onPick(n)} activeOpacity={0.7}>
            <Text style={[s.rowText, sel && s.rowTextSel]}>{pad(n)}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.card}>
          <Text style={s.preview}>{pad(hour)}:{pad(minute)}</Text>

          <View style={s.cols}>
            <Column data={hours} selected={hour} onPick={setHour} />
            <Text style={s.colon}>:</Text>
            <Column data={minutes} selected={minute} onPick={setMinute} />
          </View>

          <TouchableOpacity
            style={s.confirm}
            onPress={() => { onSelect(`${pad(hour)}:${pad(minute)}`); onClose() }}
            activeOpacity={0.85}
          >
            <Text style={s.confirmText}>{tr('common.confirm')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function makeStyles(t) {
  return StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: {
      width: '100%', maxWidth: 280, backgroundColor: t.surface, borderRadius: 16, padding: 16,
      borderWidth: t.cartoon ? t.cardBorderWidth : 1, borderColor: t.cartoon ? t.cardBorderColor : t.border,
    },
    preview:     { fontSize: 30, fontWeight: '700', color: t.text, fontFamily: t.fontTitle, textAlign: 'center', marginBottom: 12 },
    cols:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: COL_H },
    col:         { width: 64, height: COL_H },
    colon:       { fontSize: 26, fontWeight: '700', color: t.text3, marginHorizontal: 4 },
    row:         { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
    rowText:     { fontSize: 20, color: t.text3 },
    rowTextSel:  { color: t.accent, fontWeight: '700', fontSize: 24 },
    confirm:     { backgroundColor: t.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12,
                   borderWidth: t.cartoon ? t.cardBorderWidth : 0, borderColor: t.text },
    confirmText: { color: t.cartoon ? t.bg : '#fff', fontWeight: '700', fontFamily: t.fontTitle },
  })
}
