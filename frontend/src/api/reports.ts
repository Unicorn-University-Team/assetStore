import { apiGet, apiPost } from './client'

// Same reasons as REPORT_REASONS in services/community/src/models/report.model.ts (README, Nahlášení assetů).
export const REPORT_REASONS = [
  { value: 'inappropriateContent', label: 'Inappropriate content', hint: 'Offensive, violent or adult material' },
  { value: 'copyright', label: 'Copyright infringement', hint: 'Someone else’s work shared without permission' },
  { value: 'spam', label: 'Spam or misleading', hint: 'Advertising, or not what the name and description say' },
  { value: 'brokenFile', label: 'Broken or harmful file', hint: 'The file is damaged, fake or contains malware' },
  { value: 'other', label: 'Something else', hint: 'Tell us more in the comment' },
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]['value']
export const REPORT_COMMENT_MAX = 500

export const REPORT_STATUSES = ['open', 'rejected', 'resolved'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]
export type ReportStatusFilter = ReportStatus | 'all'

// Mirrors ReportView in services/community/src/views/report.view.ts. Names are null when the asset or the user
// no longer exists, or the service that knows them did not answer.
export type Report = {
  id: string
  assetId: string | null // null: the asset was deleted, a resolved report is kept as history
  assetName: string | null
  assetOwnerId: string | null
  assetOwnerName: string | null
  authorId: string
  authorName: string | null
  reason: string
  comment: string
  status: ReportStatus
  createdAt: string
  decidedById: string | null
  decidedByName: string | null
  decidedAt: string | null
}

type ReportListResponse = {
  itemList: Report[]
  pageInfo: { pageIndex: number; pageSize: number; total: number }
}

// One-based pages in the UI, like AssetPage.
export type ReportPage = { items: Report[]; page: number; pageSize: number; total: number }

export function reasonLabel(reason: string): string {
  return REPORT_REASONS.find((item) => item.value === reason)?.label ?? reason
}

export function createReport(assetId: string, reason: ReportReason, comment: string): Promise<Report> {
  return apiPost<Report>(`/assets/${encodeURIComponent(assetId)}/reports`, { reason, comment })
}

export async function listReports(status: ReportStatusFilter, page = 1, signal?: AbortSignal): Promise<ReportPage> {
  const pageSize = 20
  const query = new URLSearchParams({ status, pageIndex: String(Math.max(0, page - 1)), pageSize: String(pageSize) })
  const response = await apiGet<ReportListResponse>(`/reports?${query}`, signal)
  return {
    items: response.itemList,
    page: response.pageInfo.pageIndex + 1,
    pageSize: response.pageInfo.pageSize,
    total: response.pageInfo.total,
  }
}

export function getReport(id: string, signal?: AbortSignal): Promise<Report> {
  return apiGet<Report>(`/reports/${encodeURIComponent(id)}`, signal)
}

export function rejectReport(id: string): Promise<Report> {
  return apiPost<Report>(`/reports/${encodeURIComponent(id)}/reject`)
}
