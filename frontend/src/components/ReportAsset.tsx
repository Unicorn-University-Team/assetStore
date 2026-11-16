import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { REPORT_COMMENT_MAX, REPORT_REASONS, createReport, reasonLabel, type ReportReason } from '../api/reports'
import { useAuth } from '../auth/auth-context'
import ConfirmDialog from './ConfirmDialog'
import InlineError from './InlineError'
import { useModal } from './useModal'

type Step = 'idle' | 'choosing' | 'confirming' | 'sending' | 'sent' | 'already'

type ReasonDialogProps = {
  reason: ReportReason | ''
  comment: string
  error: string
  onReason: (reason: ReportReason) => void
  onComment: (comment: string) => void
  onCancel: () => void
  onContinue: () => void
}

// Step 1: the reason (required) and an optional comment.
function ReasonDialog({ reason, comment, error, onReason, onComment, onCancel, onContinue }: ReasonDialogProps) {
  const id = useId()
  const dialog = useRef<HTMLElement>(null)
  const firstReason = useRef<HTMLInputElement>(null)
  // Before the focus moves into the dialog: it remembers where the focus was.
  useModal(dialog)

  useEffect(() => {
    firstReason.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section ref={dialog} className="confirm-dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <span className="dialog-mark" aria-hidden="true">!</span>
        <h2 id={`${id}-title`}>Report this asset</h2>
        <p>Tell us what is wrong. An admin will review your report.</p>
        <form onSubmit={(event) => { event.preventDefault(); if (reason) onContinue() }}>
          <fieldset className="report-reasons">
            <legend className="sr-only">Reason</legend>
            {REPORT_REASONS.map((item, index) => (
              <label className={`report-reason${reason === item.value ? ' selected' : ''}`} key={item.value}>
                <input
                  ref={index === 0 ? firstReason : undefined}
                  type="radio"
                  name={`${id}-reason`}
                  value={item.value}
                  checked={reason === item.value}
                  onChange={() => onReason(item.value)}
                />
                <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              </label>
            ))}
          </fieldset>
          <label className="report-comment" htmlFor={`${id}-comment`}>
            Comment <span>(optional)</span>
          </label>
          <textarea
            id={`${id}-comment`}
            value={comment}
            maxLength={REPORT_COMMENT_MAX}
            rows={3}
            placeholder="What should the admin look at?"
            onChange={(event) => onComment(event.target.value)}
          />
          <p className="report-count">{comment.length} / {REPORT_COMMENT_MAX}</p>
          {error && <InlineError message={error} />}
          <div className="dialog-actions">
            <button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={!reason}>Continue</button>
          </div>
        </form>
      </section>
    </div>
  )
}

// US-5 on the asset page: reason → confirmation → sent. Not shown to the asset's owner (the backend refuses it too).
export default function ReportAsset({ assetId, assetName, ownerId }: { assetId: string; assetName: string; ownerId: string | null }) {
  const { user, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<Step>('idle')
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const close = useCallback(() => {
    setStep('idle')
    setError('')
  }, [])
  const back = useCallback(() => setStep('choosing'), [])

  if (status === 'loading' || (user && user.id === ownerId)) return null
  // The button that opened the dialogs is gone now, so the focus goes to the note that replaced it.
  if (step === 'sent') return <p ref={focusNote} tabIndex={-1} className="report-note" role="status">Thanks, your report was sent. An admin will review it.</p>
  if (step === 'already') return <p ref={focusNote} tabIndex={-1} className="report-note" role="status">You have already reported this asset. An admin will review it.</p>

  function start() {
    // Reporting needs an account; after logging in the visitor comes back here.
    if (!user) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    setStep('choosing')
  }

  async function send() {
    if (!reason || step === 'sending') return
    setStep('sending')
    try {
      await createReport(assetId, reason, comment.trim())
      setStep('sent')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setStep('already')
        return
      }
      setError(cause instanceof Error ? cause.message : 'The report could not be sent.')
      setStep('choosing')
    }
  }

  return (
    <>
      <button type="button" className="report-link" onClick={start}>Report this asset</button>
      {step === 'choosing' && (
        <ReasonDialog
          reason={reason}
          comment={comment}
          error={error}
          onReason={(next) => { setReason(next); setError('') }}
          onComment={setComment}
          onCancel={close}
          onContinue={() => setStep('confirming')}
        />
      )}
      {(step === 'confirming' || step === 'sending') && reason && (
        <ConfirmDialog
          title="Send this report?"
          message={`“${assetName}” will be reported for: ${reasonLabel(reason)}. An admin will review it.`}
          confirmLabel={step === 'sending' ? 'Sending…' : 'Send report'}
          cancelLabel="Back"
          busy={step === 'sending'}
          onCancel={back}
          onConfirm={() => { void send() }}
        />
      )}
    </>
  )
}

function focusNote(note: HTMLParagraphElement | null) {
  note?.focus()
}
