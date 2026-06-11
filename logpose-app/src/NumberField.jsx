import { IconChevronUp, IconChevronDown } from './Icons.jsx'

/**
 * Input numérico con stepper propio (▲▼) en lugar de las flechas nativas del
 * WebView, que no encajan con el estilo. Controlado: { value, onChange } donde
 * value/onChange usan strings (igual que un <input> normal). `step` por defecto
 * 0.1; nunca baja de `min` (por defecto 0).
 */
export default function NumberField({ value, onChange, step = 0.1, min = 0, placeholder, required }) {
  function stepBy(dir) {
    const cur = parseFloat(value)
    const start = Number.isNaN(cur) ? 0 : cur
    let next = Math.round((start + dir * step) * 10) / 10
    if (next < min) next = min
    onChange(String(next))
  }

  return (
    <div className="numfield">
      <input
        type="number" step={step} placeholder={placeholder} value={value} required={required}
        onChange={e => onChange(e.target.value)}
      />
      <div className="numfield-steppers">
        <button type="button" tabIndex={-1} className="numfield-step" onClick={() => stepBy(1)} aria-label="+">
          <IconChevronUp size={11} />
        </button>
        <button type="button" tabIndex={-1} className="numfield-step" onClick={() => stepBy(-1)} aria-label="−">
          <IconChevronDown size={11} />
        </button>
      </div>
    </div>
  )
}
