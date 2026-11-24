import { useEffect, useId, useRef } from 'react'
import { useModal } from './useModal'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  // While the confirmed action runs: buttons disabled, Escape and the backdrop do nothing.
  busy?: boolean
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, busy = false }: ConfirmDialogProps) {
  const id = useId()
  const dialog = useRef<HTMLElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  // Before the focus moves into the dialog: it remembers where the focus was.
  useModal(dialog)

  useEffect(() => {
    cancelButton.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, busy])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section ref={dialog} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}>
        <span className="dialog-mark" aria-hidden="true">!</span>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-message`}>{message}</p>
        <div className="dialog-actions">
          <button ref={cancelButton} type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="button button-primary" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
