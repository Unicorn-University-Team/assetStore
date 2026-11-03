import { HttpError } from '@assetstore/shared';
import type { Prisma } from '../generated/prisma/client';

// Actions this service writes to the audit log (AUDIT_LOG.md, section 2): US-8 delete a user.
export const AUDIT_ACTIONS = ['userDeleted'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Only ids, no name, e-mail or other personal data (AUDIT_LOG.md, section 5).
export type AuditLogEntry = {
  action: AuditAction;
  objectType: 'user';
  objectId: string;
  // Who did it (the admin); null until identity passes the logged-in user here.
  actorId?: string | null;
};

export const AuditLogModel = {
  // Takes the transaction client (tx), not the global prisma: the entry must be part of the same transaction as
  // the user deletion, so that a failed write keeps the user (AUDIT_LOG.md, section 5).
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
