import type { ReactNode } from 'react'

type StatusMessageProps = {
  kind: 'loading' | 'empty' | 'error' | 'missing'
  title: string
  message?: string
  /** h1 when this state is the whole page; h2 when the page already has a title. */
  heading?: 'h1' | 'h2'
  /** Big number above a missing page, e.g. "404". */
  code?: string
  children?: ReactNode
}

// One look for loading, nothing-to-show, a failed request, and a page that is not there.
export default function StatusMessage({ kind, title, message, heading = 'h2', code, children }: StatusMessageProps) {
  const Title = heading
  return (
    <div
      className={`state-box status-${kind}${kind === 'empty' ? ' empty-state' : ''}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading' || undefined}
    >
      {kind === 'loading' && <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>}
      {kind === 'empty' && <span className="empty-star" aria-hidden="true">✳</span>}
      {kind === 'error' && <span className="status-alert" aria-hidden="true">!</span>}
      {kind === 'missing' && (
        code
          ? <p className="status-code" aria-hidden="true">{code}<span className="period">.</span></p>
          : <span className="dialog-mark status-mark" aria-hidden="true">!</span>
      )}
      {kind === 'loading' ? <p className="status-label">{title}</p> : <Title>{title}</Title>}
      {message && <p className="status-message">{message}</p>}
      {children && <div className="status-actions">{children}</div>}
    </div>
  )
}
