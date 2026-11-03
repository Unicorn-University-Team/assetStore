import { HttpError } from '@assetstore/shared';
import type { Prisma } from '../generated/prisma/client';

// Actions this service writes to the audit log (AUDIT_LOG.md, section 2): US-6 accept and US-7 deny a report.
export const AUDIT_ACTIONS = ['reportResolved', 'reportRejected'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditLogEntry = {
  action: AuditAction;
  objectType: 'report';
  objectId: string;
  // Who did it (the admin); null until community knows the logged-in user.
  actorId?: string | null;
};

export const AuditLogModel = {
  // Takes the transaction client (tx), not the global prisma: the entry must be part of the same transaction as
  // the action, so that a failed write undoes the action too (AUDIT_LOG.md, section 4).
  async create(tx: Prisma.TransactionClient, entry: AuditLogEntry): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          action: entry.action,
          objectType: entry.objectType,
          objectId: entry.objectId,
          actorId: entry.actorId ?? null,
        },
      });
    } catch (error) {
      console.error('Writing to the audit log failed', error);
      throw new HttpError(500, 'Writing to the audit log failed.');
    }
  },
};
