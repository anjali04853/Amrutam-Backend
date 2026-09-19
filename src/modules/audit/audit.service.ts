import type { AuditRepository, AuditEntry } from './audit.repository';
import { logger } from '../../observability/logger';

export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.create(entry);
    } catch (err) {
      logger.error({ err, entry }, 'failed to write audit log');
      throw err;
    }
  }
}
