import { describe, it, expect, vi } from 'vitest';
import { PrescriptionsService } from '../../../../src/modules/prescriptions/prescriptions.service';
import type { PrescriptionsRepository } from '../../../../src/modules/prescriptions/prescriptions.repository';
import type { AuditService } from '../../../../src/modules/audit/audit.service';
import { ForbiddenError } from '../../../../src/common/errors';

vi.mock('../../../../src/jobs/queue', () => ({
  getQueue: vi.fn(() => ({ add: vi.fn(async () => undefined) })),
}));

function makeRepoMock(consultationStatus: string) {
  return {
    findConsultation: vi.fn(async () => ({ id: 'c-1', status: consultationStatus, patientId: 'p-1', doctorId: 'd-1' })),
    create: vi.fn(async (data: any) => ({ id: 'presc-1', ...data })),
  } as unknown as PrescriptionsRepository;
}

function makeAuditMock() {
  return { record: vi.fn(async () => undefined) } as unknown as AuditService;
}

describe('PrescriptionsService.issue', () => {
  it('issues a prescription for a COMPLETED consultation and enqueues jobs', async () => {
    const repo = makeRepoMock('COMPLETED');
    const audit = makeAuditMock();
    const { getQueue } = await import('../../../../src/jobs/queue');
    const service = new PrescriptionsService(repo, audit);

    const result = await service.issue('c-1', 'd-1', { medicines: [{ name: 'Paracetamol', dosage: '500mg' }] });

    expect(result.id).toBe('presc-1');
    expect(getQueue).toHaveBeenCalledWith('pdf-generation');
    expect(getQueue).toHaveBeenCalledWith('notifications');
  });

  it('rejects issuing a prescription for a non-COMPLETED consultation', async () => {
    const repo = makeRepoMock('SCHEDULED');
    const service = new PrescriptionsService(repo, makeAuditMock());
    await expect(
      service.issue('c-1', 'd-1', { medicines: [{ name: 'X', dosage: '1' }] }),
    ).rejects.toThrow(/completed/i);
  });

  it('writes a PRESCRIPTION_ISSUED audit log on success, including ipAddress', async () => {
    const repo = makeRepoMock('COMPLETED');
    const audit = makeAuditMock();
    const service = new PrescriptionsService(repo, audit);

    await service.issue('c-1', 'd-1', { medicines: [{ name: 'Paracetamol', dosage: '500mg' }] }, '203.0.113.5');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRESCRIPTION_ISSUED',
        resourceType: 'Prescription',
        actorId: 'd-1',
        ipAddress: '203.0.113.5',
      }),
    );
  });

  describe('resource ownership', () => {
    it('allows the consultation\'s assigned doctor to issue a prescription', async () => {
      const repo = makeRepoMock('COMPLETED');
      const service = new PrescriptionsService(repo, makeAuditMock());
      const result = await service.issue('c-1', 'd-1', { medicines: [{ name: 'X', dosage: '1' }] });
      expect(result.id).toBe('presc-1');
    });

    it('rejects an unrelated doctor attempting to issue a prescription', async () => {
      const repo = makeRepoMock('COMPLETED');
      const audit = makeAuditMock();
      const service = new PrescriptionsService(repo, audit);
      await expect(
        service.issue('c-1', 'attacker-doctor', { medicines: [{ name: 'X', dosage: '1' }] }),
      ).rejects.toThrow(ForbiddenError);
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
