import type { Report } from '../models/report.model';

// What the client sees. assetName is the copy stored with the report (kept after the asset is deleted); user names
// come from identity and are null when the user no longer exists or identity did not answer.
export interface ReportView {
  id: string;
  assetId: string;
  assetName: string;
  assetOwnerId: string | null;
  assetOwnerName: string | null;
  authorId: string;
  authorName: string | null;
  reason: string;
  comment: string;
  status: string;
  createdAt: string;
  decidedById: string | null;
  decidedByName: string | null;
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
    assetOwnerName: userName(names, report.assetOwnerId),
    authorId: report.authorId,
    authorName: userName(names, report.authorId),
    reason: report.reason,
    comment: report.comment,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    decidedById: report.decidedBy,
    decidedByName: userName(names, report.decidedBy),
    decidedAt: report.decidedAt?.toISOString() ?? null,
  };
}
