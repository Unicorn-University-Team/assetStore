import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { describeFailure } from '../api/client'
import { listReports, reasonLabel, type ReportPage, type ReportStatusFilter } from '../api/reports'
import Pagination from '../components/Pagination'
import StatusMessage from '../components/StatusMessage'
import ReportStatusBadge from '../components/ReportStatusBadge'
import { formatDateTime } from '../formatDate'
import { useLiveTick } from '../useLiveTick'
import { usePageTitle } from '../usePageTitle'
import StatusFilter from '../components/StatusFilter'

const FILTERS: { value: ReportStatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

function readFilter(value: string | null): ReportStatusFilter {
  return FILTERS.find((item) => item.value === value)?.value ?? 'open'
}

// A notice handed over by the report detail page after a decision, e.g. "Report denied."
function readNotice(state: unknown): string {
  return state && typeof state === 'object' && 'notice' in state && typeof state.notice === 'string' ? state.notice : ''
}

// US-7 list for admins: newest first, open reports by default, filtered by status in the URL (?status=).
export default function AdminReportsPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const status = readFilter(params.get('status'))
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const request = `${status}:${page}`
  const [loaded, setLoaded] = useState<{ request: string; result: ReportPage | null; error: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // The notice is kept here and removed from the history entry at once, so a reload does not show it again.
  const [notice, setNotice] = useState(() => readNotice(location.state))
  const handedNotice = readNotice(location.state)
  usePageTitle('Reports')
  // New reports from users show up without a reload.
  const tick = useLiveTick(30_000)

  useEffect(() => {
    if (handedNotice) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [handedNotice, navigate, location.pathname, location.search])

  useEffect(() => {
    const controller = new AbortController()
    listReports(status, page, controller.signal)
      .then((result) => setLoaded({ request, result, error: '' }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const failure = describeFailure(cause, 'Could not load the reports.')
        // A failed quiet refresh keeps the reports already on the screen.
        setLoaded((previous) => previous?.request === request && previous.result ? previous : { request, result: null, error: failure.message })
      })
    return () => controller.abort()
  }, [status, page, request, tick, retryKey])

  const loading = loaded?.request !== request
  const result = loading ? null : loaded.result
  const error = loading ? '' : loaded.error
  const reports = result?.items ?? []

  function retry() {
    setLoaded(null)
    setRetryKey((value) => value + 1)
  }

  function changeFilter(next: ReportStatusFilter) {
    setParams(next === 'open' ? {} : { status: next })
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setParams(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <main className="content-width admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Reports</h1>
        </div>
        {result && <p className="admin-count">{result.total} {result.total === 1 ? 'report' : 'reports'}</p>}
      </div>
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
          <button type="button" className="text-link" onClick={() => setNotice('')}>Dismiss</button>
        </p>
      )}
      <StatusFilter label="Filter by status" options={FILTERS} value={status} onChange={changeFilter} />
      {loading && <StatusMessage kind="loading" title="Loading reports" />}
      {!loading && error && (
        <StatusMessage kind="error" title="Could not load the reports" message={error}>
          <button type="button" className="button button-primary" onClick={retry}>Try again</button>
        </StatusMessage>
      )}
      {!loading && !error && !reports.length && (
        <StatusMessage
          kind="empty"
          title={result && result.total > 0 ? 'This page is empty' : status === 'open' ? 'No open reports' : 'No reports'}
          message={result && result.total > 0 ? 'There are fewer reports than this page needs.' : status === 'open' ? 'Nothing waits for a decision.' : 'No report has this status yet.'}
        >
          {result && result.total > 0 && <button type="button" className="button button-secondary" onClick={() => changePage(1)}>Back to the first page</button>}
        </StatusMessage>
      )}
      {!loading && !error && reports.length > 0 && (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>Asset</th><th>Owner</th><th>Reported by</th><th>Reason</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} onClick={() => navigate(`/admin/reports/${report.id}`)}>
                  <td>
                    <Link to={`/admin/reports/${report.id}`} onClick={(event) => event.stopPropagation()}>
                      {report.assetName ?? <em>Deleted asset</em>}
                    </Link>
                  </td>
                  <td>{report.assetOwnerName ?? '—'}</td>
                  <td>{report.authorName ?? '—'}</td>
                  <td>{reasonLabel(report.reason)}</td>
                  <td className="nowrap">{formatDateTime(report.createdAt)}</td>
                  <td><ReportStatusBadge status={report.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && result && (
        <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={changePage} />
      )}
    </main>
  )
}
