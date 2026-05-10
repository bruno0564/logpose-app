import { useState } from 'react'

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

export default function Calendar() {
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
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Calendario</h1>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="cal-month-row">
          <button className="cal-arrow" onClick={prev}>‹</button>
          <span className="cal-month-label">{MONTHS[month]} {year}</span>
          <button className="cal-arrow" onClick={next}>›</button>
        </div>

        <div className="cal-grid">
          {DAY_LABELS.map(d => (
            <div key={d} className="cal-day-name">{d}</div>
          ))}
          {cells.map((day, i) => {
            const isToday = isThisMonth && day === today.getDate()
            return (
              <div key={i} className="cal-cell">
                {day !== null && (
                  <span className={`cal-day${isToday ? ' cal-day--today' : ''}`}>
                    {day}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
