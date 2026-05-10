import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function buildCells(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const offset = (firstWeekday + 6) % 7  // lunes = 0
  const total = new Date(year, month + 1, 0).getDate()
  const cells = Array(offset).fill(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function CalendarScreen() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const cells = buildCells(year, month)
  const isThisMonth = year === today.getFullYear() && month === today.getMonth()

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Calendario</Text>
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
          {DAY_LABELS.map(d => (
            <Text key={d} style={s.dayLabel}>{d}</Text>
          ))}
        </View>

        <View style={s.grid}>
          {cells.map((day, i) => {
            const isToday = isThisMonth && day === today.getDate()
            return (
              <View key={i} style={s.cell}>
                {day !== null && (
                  <View style={[s.dayWrap, isToday && s.todayWrap]}>
                    <Text style={[s.dayNum, isToday && s.todayNum]}>{day}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f0f0f' },
  header:     { padding: 20, paddingTop: 60 },
  title:      { color: '#fff', fontSize: 22, fontWeight: '700' },
  card:       { backgroundColor: '#1a1a1a', borderRadius: 16, marginHorizontal: 16, padding: 20 },
  monthRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  arrowBtn:   { padding: 8 },
  arrow:      { color: '#7c3aed', fontSize: 28, lineHeight: 30 },
  monthLabel: { color: '#fff', fontSize: 17, fontWeight: '600' },
  dayRow:     { flexDirection: 'row', marginBottom: 6 },
  dayLabel:   { flex: 1, textAlign: 'center', color: '#444', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  cell:       { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayWrap:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayWrap:  { backgroundColor: '#7c3aed' },
  dayNum:     { color: '#888', fontSize: 14 },
  todayNum:   { color: '#fff', fontWeight: '700', fontSize: 14 },
})
