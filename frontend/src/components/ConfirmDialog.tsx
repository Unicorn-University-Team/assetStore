import { useEffect, useId, useRef } from 'react'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: ConfirmDialogProps) {
  const id = useId()
  const cancelButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButton.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}>
        <span className="dialog-mark" aria-hidden="true">!</span>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-message`}>{message}</p>
        <div className="dialog-actions">
          <button ref={cancelButton} type="button" className="button button-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="button button-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
