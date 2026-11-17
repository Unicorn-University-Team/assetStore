import { HttpError } from '@assetstore/shared';
import { prisma } from '../db/prisma';
import type { Report } from '../generated/prisma/client';
import { AuditLogModel } from './audit-log.model';

export type { Report };

// Same lists as the CHECK constraints in the add_report migration and REPORT_REASONS in the frontend.
export const REPORT_REASONS = ['copyright', 'inappropriate', 'malware', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_STATUSES = ['open', 'resolved', 'rejected'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type ReportInput = {
  assetId: string;
  assetOwnerId: string | null;
  authorId: string;
  reason: ReportReason;
  comment: string;
};

export const ReportModel = {
  // One open report per user and asset: a second one would only repeat the first.
  async create(input: ReportInput): Promise<Report> {
    return prisma.$transaction(async (tx) => {
      const open = await tx.report.findFirst({
        where: { assetId: input.assetId, authorId: input.authorId, status: 'open' },
        select: { id: true },
      });
      if (open) throw new HttpError(409, 'You have already reported this asset');
      return tx.report.create({ data: input });
    });
  },

  // Newest first; id breaks ties so that paging never repeats or skips a report. status null = all.
  async findPage(options: { status: ReportStatus | null; pageIndex: number; pageSize: number }) {
    const where = options.status ? { status: options.status } : {};
    const [items, total] = await prisma.$transaction([
      prisma.report.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: options.pageIndex * options.pageSize,
        take: options.pageSize,
      }),
      prisma.report.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string): Promise<Report | null> {
    return prisma.report.findUnique({ where: { id } });
  },

  // US-7: the admin denies an open report. The change and its audit log entry are one transaction
  // (README, Audit log, rule 1). null = no such report.
  reject(id: string, adminId: string): Promise<Report | null> {
    return prisma.$transaction(async (tx) => {
      // Only an open report changes; a report decided in the meantime is a 409, not a second decision.
      const { count } = await tx.report.updateMany({
        where: { id, status: 'open' },
        data: { status: 'rejected', decidedBy: adminId, decidedAt: new Date() },
      });
      const report = await tx.report.findUnique({ where: { id } });
      if (!report) return null;
      if (count === 0) throw new HttpError(409, `The report is already ${report.status}`);
      await AuditLogModel.create(tx, { action: 'reportRejected', objectType: 'report', objectId: id, actorId: adminId });
      return report;
    });
  },
};
