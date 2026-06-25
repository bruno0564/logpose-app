// Lógica de display de los contadores, compartida por Home y la pantalla
// Contadores. A partir de la fecha objetivo ('YYYY-MM-DD') y si es anual,
// calcula cuánto falta (o cuánto ha pasado) y en qué unidad mostrarlo.
//
// Devuelve { direction, unit, value }:
//   direction: 'today'  → la fecha es hoy
//              'future'  → cuenta atrás ("faltan…")
//              'past'    → cuenta hacia delante ("hace…"), solo no recurrentes
//   unit:  'days' | 'hours' | 'minutes'   (días por defecto; horas/min cuando
//          falta menos de un día — el cliente pidió ver horas en ese tramo)
//   value: entero positivo
export function countdownState(targetDate, isRecurring, now = new Date()) {
  const [y0, m0, d0] = targetDate.split('-').map(Number) // m0 es 1-12
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let year = y0
  if (isRecurring) {
    // Próxima ocurrencia anual: este año; si ya pasó hoy, el año siguiente.
    let target = new Date(now.getFullYear(), m0 - 1, d0)
    if (target < todayMid) target = new Date(now.getFullYear() + 1, m0 - 1, d0)
    year = target.getFullYear()
  }

  const targetMid = new Date(year, m0 - 1, d0)
  const dayDiff = Math.round((targetMid - todayMid) / 86400000)

  if (dayDiff === 0) return { direction: 'today', unit: 'days', value: 0 }

  if (dayDiff > 0) {
    // Futuro. Si falta menos de un día hasta la medianoche objetivo, horas;
    // si falta menos de una hora, minutos.
    const msToTarget = targetMid - now
    const hours = msToTarget / 3600000
    if (hours < 1) return { direction: 'future', unit: 'minutes', value: Math.max(1, Math.ceil(msToTarget / 60000)) }
    if (hours < 24) return { direction: 'future', unit: 'hours', value: Math.ceil(hours) }
    return { direction: 'future', unit: 'days', value: dayDiff }
  }

  // Pasado: cuenta hacia delante. Los recurrentes nunca llegan aquí.
  return { direction: 'past', unit: 'days', value: -dayDiff }
}

// Clave de ordenación: primero los más próximos en el futuro (incluido hoy),
// luego los pasados (de más reciente a más antiguo). Usa la misma lógica de
// ocurrencia anual para que los recurrentes se ordenen por su próxima fecha.
export function countdownSortKey(targetDate, isRecurring, now = new Date()) {
  const st = countdownState(targetDate, isRecurring, now)
  if (st.direction === 'today') return 0
  if (st.direction === 'future') return st.unit === 'days' ? st.value : 0.5
  return 100000 + st.value // pasados al final
}

// Texto ya traducido a partir del estado y la función de plurales tp().
export function countdownLabel(state, tr, tp) {
  if (state.direction === 'today') return tr('countdowns.today')
  const dir = state.direction === 'future' ? 'in' : 'ago'
  const unit = state.unit === 'days' ? 'Days' : state.unit === 'hours' ? 'Hours' : 'Minutes'
  return tp(`countdowns.${dir}${unit}`, state.value)
}
