import type { AssetSummary } from '../clients/catalog.client';
import type { Report } from '../models/report.model';

// What the client sees. Names come from catalog and identity; null when the asset is deleted, the user no longer
// exists or the other service did not answer.
export interface ReportView {
  id: string;
  assetId: string;
  assetName: string | null;
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
  assets: ReadonlyMap<string, AssetSummary>;
  users: ReadonlyMap<string, string>;
};

const NO_NAMES: ReportNames = { assets: new Map(), users: new Map() };

function userName(names: ReportNames, id: string | null): string | null {
  return (id && names.users.get(id)) ?? null;
}

export function toReportView(report: Report, names: ReportNames = NO_NAMES): ReportView {
  return {
    id: report.id,
    assetId: report.assetId,
    assetName: names.assets.get(report.assetId)?.name ?? null,
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
