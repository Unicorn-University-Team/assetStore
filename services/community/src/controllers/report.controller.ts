import type { Request, Response } from 'express';
import { HttpError } from '@assetstore/shared';
import { CatalogClient } from '../clients/catalog.client';
import { IdentityClient } from '../clients/identity.client';
import {
  REPORT_REASONS,
  REPORT_STATUSES,
  ReportModel,
  type Report,
  type ReportReason,
  type ReportStatus,
} from '../models/report.model';
import { toReportView, type ReportNames } from '../views/report.view';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function readReason(value: unknown): ReportReason {
  const reason = REPORT_REASONS.find((item) => item === value);
  if (!reason) throw new HttpError(400, `"reason" must be one of: ${REPORT_REASONS.join(', ')}`);
  return reason;
}

function readComment(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, '"comment" must be a string');
  if (value.trim().length > 500) throw new HttpError(400, '"comment" must be at most 500 characters');
  return value.trim();
}

// report/list filter: open (default), resolved, rejected or all.
function readStatus(value: unknown): ReportStatus | null {
  if (value === undefined) return 'open';
  if (value === 'all') return null;
  const status = REPORT_STATUSES.find((item) => item === value);
  if (!status) throw new HttpError(400, `"status" must be one of: ${REPORT_STATUSES.join(', ')}, all`);
  return status;
}

// Whole number from the query string. max = null means no upper limit.
function readInteger(field: string, value: unknown, min: number, max: number | null, fallback: number): number {
  if (value === undefined) return fallback;
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || (max !== null && number > max)) {
    const range = max === null ? `>= ${min}` : `from ${min} to ${max}`;
    throw new HttpError(400, `"${field}" must be an integer ${range}`);
  }
  return number;
}

// Invalid ids are reported as "not found" instead of reaching the database as a malformed uuid.
async function findReport(id: string): Promise<Report> {
  const report = UUID.test(id) ? await ReportModel.findById(id) : null;
  if (!report) throw new HttpError(404, 'Report not found');
  return report;
}

// User names from identity, one call for all the reports. The asset name is stored in the report itself.
async function namesFor(reports: Report[]): Promise<ReportNames> {
  const users = await IdentityClient.usernames(
    reports.flatMap((report) => [report.authorId, report.assetOwnerId, report.decidedBy]),
  );
  return { users };
}

export const ReportController = {
  // US-5, POST /api/assets/:assetId/reports: { reason, comment? }. Any logged-in user except the asset's owner.
  async create(req: Request<{ assetId: string }>, res: Response) {
    const authorId: string = res.locals.userId;
    const body = (req.body ?? {}) as { reason?: unknown; comment?: unknown };
    const reason = readReason(body.reason);
    const comment = readComment(body.comment);

    const assetId = req.params.assetId.toLowerCase();
    const asset = UUID.test(assetId) ? (await CatalogClient.assetSummaries([assetId])).get(assetId) : undefined;
    if (!asset) throw new HttpError(404, 'Asset not found');
    if (asset.ownerId === authorId) throw new HttpError(403, 'You cannot report your own asset');

    const report = await ReportModel.create({
      assetId,
      assetName: asset.name,
      assetOwnerId: asset.ownerId,
      authorId,
      reason,
      comment,
    });
    res.status(201).json(toReportView(report));
  },

  // GET /api/reports?status=&pageIndex=&pageSize= (admin): newest first, open ones by default.
  async list(req: Request, res: Response) {
    const status = readStatus(req.query.status);
    const pageIndex = readInteger('pageIndex', req.query.pageIndex, 0, null, 0);
    const pageSize = readInteger('pageSize', req.query.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const { items, total } = await ReportModel.findPage({ status, pageIndex, pageSize });
    const names = await namesFor(items);

    res.json({ itemList: items.map((report) => toReportView(report, names)), pageInfo: { pageIndex, pageSize, total } });
  },

  // GET /api/reports/:id (admin)
  async getById(req: Request<{ id: string }>, res: Response) {
    const report = await findReport(req.params.id);
    res.json(toReportView(report, await namesFor([report])));
  },

  // US-7, POST /api/reports/:id/reject (admin): open -> rejected; a decided report is a 409.
  async reject(req: Request<{ id: string }>, res: Response) {
    const report = UUID.test(req.params.id) ? await ReportModel.reject(req.params.id, res.locals.userId) : null;
    if (!report) throw new HttpError(404, 'Report not found');
    res.json(toReportView(report, await namesFor([report])));
  },
};
