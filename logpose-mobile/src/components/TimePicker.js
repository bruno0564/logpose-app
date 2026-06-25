import { useState, useEffect, useRef } from 'react'
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import Text from './Text'
import { useTheme } from '../ThemeContext'
import { useLang } from '../LangContext'

/**
 * Selector de hora propio, con el estilo de la app (en vez del reloj nativo de
 * Android, que no se puede reestilar). Dos columnas tipo rueda: horas (00–23) y
 * minutos (00–59). Se elige desplazando (engancha a cada fila) o tocando un
 * número; al confirmar devuelve 'HH:MM'.
 *
 * Props: visible, value ('HH:MM' | ''), onSelect(timeStr), onClose()
 */
const pad = n => String(n).padStart(2, '0')
const ROW_H = 44
const COL_H = 200
const PAD_V = COL_H / 2 - ROW_H / 2   // relleno para que el primer/último valor centre

function parseValue(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '')
  if (m) return [Math.min(23, +m[1]), Math.min(59, +m[2])]
  const now = new Date()
  return [now.getHours(), now.getMinutes()]
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

export default function TimePicker({ visible, value, onSelect, onClose }) {
  const { theme: t } = useTheme()
  const { t: tr } = useLang()
  const s = makeStyles(t)
  const [hour, setHour] = useState(0)
  const [minute, setMinute] = useState(0)
  const hoursRef = useRef(null)
  const minutesRef = useRef(null)

  // Al abrir, colocamos las columnas sobre el valor recibido (sin animar).
  useEffect(() => {
    if (!visible) return
    const [h, m] = parseValue(value)
    setHour(h); setMinute(m)
    requestAnimationFrame(() => {
      hoursRef.current?.scrollTo({ y: h * ROW_H, animated: false })
      minutesRef.current?.scrollTo({ y: m * ROW_H, animated: false })
    })
  }, [visible])

  // La fila que queda centrada es la seleccionada. Actualizamos en vivo mientras
  // se arrastra (onScroll) para que el resaltado siga al dedo sin esperar a que
  // pare; el setter funcional evita renders de más cuando no cambia el número.
  function centerSetter(setter, max) {
    return e => {
      const idx = Math.max(0, Math.min(max, Math.round(e.nativeEvent.contentOffset.y / ROW_H)))
      setter(prev => (prev === idx ? prev : idx))
    }
  }

  function pick(ref, setter) {
    return n => { setter(n); ref.current?.scrollTo({ y: n * ROW_H, animated: true }) }
  }

  const Column = (data, selected, ref, onPick, onCenter) => (
    <ScrollView
      ref={ref}
      style={s.col}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW_H}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onCenter}
      onMomentumScrollEnd={onCenter}
      contentContainerStyle={{ paddingVertical: PAD_V }}
    >
      {data.map(n => (
        <TouchableOpacity key={n} style={s.row} onPress={() => onPick(n)} activeOpacity={0.7}>
          <Text style={[s.rowText, n === selected && s.rowTextSel]}>{pad(n)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.card}>
          <Text style={s.preview}>{pad(hour)}:{pad(minute)}</Text>

          <View style={s.cols}>
            {Column(HOURS, hour, hoursRef, pick(hoursRef, setHour), centerSetter(setHour, 23))}
            <Text style={s.colon}>:</Text>
            {Column(MINUTES, minute, minutesRef, pick(minutesRef, setMinute), centerSetter(setMinute, 59))}
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
