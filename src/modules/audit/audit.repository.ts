import type { PrismaClient } from '@prisma/client';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

export class AuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        before: entry.before as never,
        after: entry.after as never,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
