import type { Report } from '../models/report.model';

// What the client sees. assetName is the copy stored with the report (kept after the asset is deleted); user names
// come from identity and are null when the user no longer exists or identity did not answer.
export interface ReportView {
  id: string;
  assetId: string | null;
  assetName: string;
  assetOwnerId: string | null;
  authorId: string;
  reason: string;
  status: string;
  createdAt: string;
  decidedById: string | null;
  decidedAt: string | null;
}

export type ReportNames = {
  users: ReadonlyMap<string, string>;
};

const NO_NAMES: ReportNames = { users: new Map() };

function userName(names: ReportNames, id: string | null): string | null {
  return (id && names.users.get(id)) ?? null;
}

export function toReportView(report: Report, names: ReportNames = NO_NAMES): ReportView {
  return {
    id: report.id,
    assetId: report.assetId,
    assetName: report.assetName,
    assetOwnerId: report.assetOwnerId,
    authorId: report.authorId,
    reason: report.reason,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    decidedAt: report.decidedAt?.toISOString() ?? null,
    decidedById: report.decidedById,
  };
}
