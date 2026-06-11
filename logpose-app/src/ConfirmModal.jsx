import { useLang } from './LangContext.jsx'
import { IconClose } from './Icons.jsx'

// Diálogo de confirmación de borrado, reutilizable en toda la app.
export default function ConfirmModal({ message, onConfirm, onCancel }) {
  const { t: tr } = useLang()
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>{tr('common.confirm')}</span>
          <button onClick={onCancel} className="btn-delete"><IconClose /></button>
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', padding: '1rem 1rem 0' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '1rem' }}>
          <button className="btn-cancel" onClick={onCancel}>{tr('common.cancel')}</button>
          <button className="btn-delete" onClick={onConfirm}>{tr('common.delete')}</button>
        </div>
      </div>
    </div>
  )
}
