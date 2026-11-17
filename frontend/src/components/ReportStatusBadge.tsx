import type { ReportStatus } from '../api/reports'

const LABELS: Record<ReportStatus, string> = { open: 'Open', rejected: 'Rejected', resolved: 'Resolved' }

export default function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <span className={`report-status status-${status}`}>{LABELS[status] ?? status}</span>
}
