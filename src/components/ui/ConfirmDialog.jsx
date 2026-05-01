import './ConfirmDialog.css'
import { Trash } from './Icons.jsx'

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null

  return (
    <div className="confirm-dialog-backdrop" onClick={onCancel} aria-modal="true" role="dialog">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog__icon-wrap">
          <Trash style={{ width: 18, height: 18 }} />
        </div>

        <h3 className="confirm-dialog__title">{title}</h3>
        <p className="confirm-dialog__message">{message}</p>

        <div className="confirm-dialog__actions">
          <button className="confirm-dialog__btn confirm-dialog__btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-dialog__btn confirm-dialog__btn--danger" onClick={onConfirm} autoFocus>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
