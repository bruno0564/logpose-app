// Lógica de ocurrencia de eventos del calendario, compartida por la pantalla
// Calendario (cuadrícula y agenda) y el Home. Los días de la semana van 0=lunes
// … 6=domingo, igual que en el resto de la app.

export function toDateStr(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function dowOf(d) {
  return (d.getDay() + 6) % 7
}

// ¿Ocurre el evento en esta fecha? Contempla las tres recurrencias.
export function eventOccursOn(ev, dateStr, dow) {
  if (ev.recurrence === 'none') return ev.date === dateStr
  if (ev.recurrence === 'daily') return true
  if (ev.recurrence === 'weekly') {
    const days = ev.days_of_week ? ev.days_of_week.split(',').map(Number) : []
    return days.includes(dow)
  }
  return false
}

// Eventos de una fecha, ordenados por hora de inicio (los sin hora, al final).
export function eventsForDate(events, dateStr, dow) {
  return events
    .filter(ev => eventOccursOn(ev, dateStr, dow))
    .sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'))
}

// Próximos días con eventos a partir de `from`, mirando `days` días hacia
// delante. Devuelve [{ date, dateStr, isToday, events }] solo para los días que
// tienen alguno.
export function upcomingEventDays(events, from, days) {
  const out = []
  const todayStr = toDateStr(from)
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    const ds = toDateStr(d)
    const evs = eventsForDate(events, ds, dowOf(d))
    if (evs.length > 0) out.push({ date: d, dateStr: ds, isToday: ds === todayStr, events: evs })
  }
  return out
}
