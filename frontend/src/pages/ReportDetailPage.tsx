import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, describeFailure } from '../api/client'
import { denyReport, getReport, reasonLabel, type Report } from '../api/reports'
import ConfirmDialog from '../components/ConfirmDialog'
import InlineError from '../components/InlineError'
import StatusMessage from '../components/StatusMessage'
import ReportStatusBadge from '../components/ReportStatusBadge'
import { formatDateTime } from '../formatDate'
import { usePageTitle } from '../usePageTitle'

// One report for the admin: asset, owner, author, reason, date, and US-7 deny while it is open.
export default function ReportDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // The answer remembers its id, like the asset detail page.
  const [loaded, setLoaded] = useState<{ id: string; report: Report | null; error: string; status: number } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getReport(id, controller.signal)
      .then((report) => setLoaded({ id, report, error: '', status: 0 }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const failure = describeFailure(cause, 'Could not load this report.')
        setLoaded({ id, report: null, error: failure.message, status: failure.status })
      })
    return () => controller.abort()
  }, [id, retryKey])

  const current = loaded?.id === id ? loaded : null
  const report = current?.report ?? null
  const error = current?.error ?? ''
  const missing = current?.status === 404
  usePageTitle(report ? `Report: ${report.assetName ?? 'deleted asset'}` : missing ? 'Report not found' : error ? 'Could not load report' : 'Report')

  const cancelDeny = useCallback(() => setConfirming(false), [])

  async function deny() {
    if (busy) return
    setBusy(true)
    setActionError('')
    try {
      await denyReport(id)
      // Back to the open reports, where this one is no longer listed.
      navigate('/admin/reports', { state: { notice: 'Report denied. It is now in the rejected reports.' } })
    } catch (cause) {
      setConfirming(false)
      setActionError(cause instanceof Error ? cause.message : 'The report could not be denied.')
      // Somebody else decided it in the meantime: show its current state.
      if (cause instanceof ApiError && cause.status === 409) {
        getReport(id).then((fresh) => setLoaded({ id, report: fresh, error: '', status: 0 })).catch(() => undefined)
      }
    } finally {
      setBusy(false)
    }
  }

  function retry() {
    setLoaded(null)
    setRetryKey((value) => value + 1)
  }

  const breadcrumbs = <div className="breadcrumbs"><Link to="/admin/reports">Reports</Link><span>/</span><span>Report</span></div>
  if (error) {
    return (
      <main className="content-width page-state">
        {breadcrumbs}
        {missing ? (
          <StatusMessage kind="missing" heading="h1" title="Report not found" message="This report does not exist, or it is no longer available.">
            <Link className="button button-primary" to="/admin/reports">Back to the reports</Link>
          </StatusMessage>
        ) : (
          <StatusMessage kind="error" heading="h1" title="Could not load this report" message={error}>
            <button type="button" className="button button-primary" onClick={retry}>Try again</button>
            <Link className="button button-secondary" to="/admin/reports">Back to the reports</Link>
          </StatusMessage>
        )}
      </main>
    )
  }
  if (!report) return <main className="content-width page-state"><StatusMessage kind="loading" title="Loading report" /></main>

  return (
    <main className="content-width admin-page">
      {breadcrumbs}
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Report</p>
          <h1>{report.assetName ?? 'Deleted asset'}</h1>
        </div>
        <ReportStatusBadge status={report.status} />
      </div>
      {actionError && <InlineError message={actionError} />}
      <dl className="report-facts">
        <div>
          <dt>Asset</dt>
          <dd>{report.assetId && report.assetName
            ? <Link to={`/assets/${encodeURIComponent(report.assetId)}`}>{report.assetName}</Link>
            : `${report.assetName ? `${report.assetName}, d` : 'D'}eleted from the catalogue`}</dd>
        </div>
        <div><dt>Owner</dt><dd>{report.assetOwnerName ?? 'Unknown'}</dd></div>
        <div><dt>Reported by</dt><dd>{report.authorName ?? 'Unknown'}</dd></div>
        <div><dt>Reason</dt><dd>{reasonLabel(report.reason)}</dd></div>
        <div><dt>Reported on</dt><dd>{formatDateTime(report.createdAt)}</dd></div>
        {report.status !== 'open' && (
          <div>
            <dt>{report.status === 'rejected' ? 'Denied' : 'Resolved'}</dt>
            <dd>{report.decidedAt ? formatDateTime(report.decidedAt) : '—'}</dd>
          </div>
        )}
      </dl>
      <div className="report-actions">
        <Link className="button button-secondary" to="/admin/reports">Back to the reports</Link>
        {report.status === 'open' && (
          <button type="button" className="button button-primary" onClick={() => setConfirming(true)} disabled={busy}>Deny report</button>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          title="Deny this report?"
          message="The report will be marked as rejected and leave the open reports. The asset stays in the catalogue."
          confirmLabel={busy ? 'Denying…' : 'Deny report'}
          cancelLabel="Keep it open"
          busy={busy}
          onCancel={cancelDeny}
          onConfirm={() => { void deny() }}
        />
      )}
    </main>
  )
}
