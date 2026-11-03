import { HttpError } from '@assetstore/shared';
import type { Prisma } from '../generated/prisma/client';

// Actions this service writes to the audit log (AUDIT_LOG.md, section 2).
export const AUDIT_ACTIONS = ['assetCreated', 'assetUpdated', 'assetDeleted'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// For assetUpdated: the changed fields with their old and new values. Values must fit into a JSON column.
type AuditValue = Prisma.InputJsonValue | null;
export type AuditChanges = Record<string, { old: AuditValue; new: AuditValue }>;

export type AuditLogEntry = {
  action: AuditAction;
  objectType: 'asset';
  objectId: string;
  // Who did it; null until catalog knows the logged-in user.
  actorId?: string | null;
  changes?: AuditChanges;
};

// Compares the given fields of two versions of an object and keeps only those that differ.
export function diffFields<K extends string>(
  before: Record<K, AuditValue>,
  after: Record<K, AuditValue>,
  fields: readonly K[],
): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of fields) {
    if (before[field] !== after[field]) changes[field] = { old: before[field], new: after[field] };
  }
  return changes;
}

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
          changes: entry.changes,
        },
      });
    } catch (error) {
      console.error('Writing to the audit log failed', error);
      throw new HttpError(500, 'Writing to the audit log failed.');
    }
  },
};
