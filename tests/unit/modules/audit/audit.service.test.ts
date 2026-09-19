import { describe, it, expect, vi } from 'vitest';
import { AuditService } from '../../../../src/modules/audit/audit.service';
import type { AuditRepository } from '../../../../src/modules/audit/audit.repository';

describe('AuditService', () => {
  it('writes an audit entry through the repository', async () => {
    const repo = { create: vi.fn(async () => undefined) } as unknown as AuditRepository;
    const service = new AuditService(repo);

    await service.record({
      actorId: 'user-1',
      action: 'CONSULTATION_CREATED',
      resourceType: 'Consultation',
      resourceId: 'consult-1',
      after: { status: 'SCHEDULED' },
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'CONSULTATION_CREATED',
        resourceType: 'Consultation',
        resourceId: 'consult-1',
      }),
    );
  });
});
