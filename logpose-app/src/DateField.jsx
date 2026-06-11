import { useState, useEffect, useRef } from 'react'
import { IconChevronLeft, IconChevronRight, IconCalendar } from './Icons.jsx'

/**
 * Selector de fecha propio con el estilo de la app (en vez del calendario
 * nativo del WebView, que no se puede reestilar). Popover con rejilla mensual
 * navegable; al tocar un día devuelve 'YYYY-MM-DD'. Misma lógica que el
 * DatePicker del móvil. Controlado: { value, onChange }.
 */
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const pad = n => String(n).padStart(2, '0')
const toStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

export default function DateField({ value, onChange, placeholder, min, max }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const base = () => (value ? new Date(value + 'T12:00:00') : new Date())
  const [cursor, setCursor] = useState(() => { const d = base(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  // al abrir, situar el calendario en el mes del valor actual
  useEffect(() => {
    if (open) { const d = base(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

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

  // navegación: no dejar saltar a un mes entero fuera de [min, max]
  const pLast = new Date(year, month, 0)       // último día del mes anterior
  const nFirst = new Date(year, month + 1, 1)  // primer día del mes siguiente
  const prevLast  = toStr(pLast.getFullYear(), pLast.getMonth(), pLast.getDate())
  const nextFirst = toStr(nFirst.getFullYear(), nFirst.getMonth(), nFirst.getDate())
  const prevDisabled = min && prevLast < min
  const nextDisabled = max && nextFirst > max

  return (
    <div className="datefield" ref={ref}>
      <button type="button" className="datefield-trigger" onClick={() => setOpen(o => !o)}>
        <span className={value ? 'datefield-text' : 'datefield-text datefield-placeholder'}>
          {value || placeholder || '—'}
        </span>
        <span className="datefield-cal"><IconCalendar size={15} /></span>
      </button>

      {open && (
        <div className="datefield-pop">
          <div className="datefield-head">
            <button type="button" className="datefield-nav" disabled={prevDisabled} onClick={() => setCursor(new Date(year, month - 1, 1))}>
              <IconChevronLeft size={18} />
            </button>
            <span className="datefield-month">{monthLabel}</span>
            <button type="button" className="datefield-nav" disabled={nextDisabled} onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <IconChevronRight size={18} />
            </button>
          </div>

          <div className="datefield-week">
            {WD.map((w, i) => <span key={i} className="datefield-wd">{w}</span>)}
          </div>

          <div className="datefield-grid">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} className="datefield-cell" />
              const ds    = toStr(year, month, d)
              const sel   = ds === value
              const today = ds === todayStr
              const off   = (min && ds < min) || (max && ds > max)
              return (
                <button
                  type="button" key={i} disabled={off}
                  className={`datefield-cell datefield-day${today ? ' is-today' : ''}${sel ? ' is-sel' : ''}${off ? ' is-off' : ''}`}
                  onClick={() => { onChange(ds); setOpen(false) }}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
