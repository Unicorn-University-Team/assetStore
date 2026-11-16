import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { listReports, reasonLabel, type ReportPage, type ReportStatusFilter } from '../api/reports'
import InlineError from '../components/InlineError'
import Pagination from '../components/Pagination'
import ReportStatusBadge from '../components/ReportStatusBadge'
import { formatDateTime } from '../formatDate'
import { usePageTitle } from '../usePageTitle'

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
  const notice = readNotice(location.state)
  usePageTitle('Reports')

  useEffect(() => {
    const controller = new AbortController()
    listReports(status, page, controller.signal)
      .then((result) => setLoaded({ request, result, error: '' }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({ request, result: null, error: cause instanceof Error ? cause.message : 'Could not load the reports.' })
        }
      })
    return () => controller.abort()
  }, [status, page, request])

  const loading = loaded?.request !== request
  const result = loading ? null : loaded.result
  const error = loading ? '' : loaded.error
  const reports = result?.items ?? []

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
          <button type="button" className="text-link" onClick={() => navigate(location.pathname + location.search, { replace: true })}>Dismiss</button>
        </p>
      )}
      <div className="filter-tabs" role="group" aria-label="Filter by status">
        {FILTERS.map((item) => (
          <button type="button" key={item.value} aria-pressed={status === item.value} onClick={() => changeFilter(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
      {loading && <div className="state-box" role="status">Loading reports<span className="loading-dots">...</span></div>}
      {!loading && error && <InlineError message={error} />}
      {!loading && !error && !reports.length && (
        <div className="state-box empty-state">
          <span className="empty-star">✳</span>
          <h2>{result && result.total > 0 ? 'This page is empty' : status === 'open' ? 'No open reports' : 'No reports'}</h2>
          <p>{result && result.total > 0 ? 'There are fewer reports than this page needs.' : status === 'open' ? 'Nothing waits for a decision.' : 'No report has this status yet.'}</p>
          {result && result.total > 0 && <button type="button" className="button button-secondary" onClick={() => changePage(1)}>Back to the first page</button>}
        </div>
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
