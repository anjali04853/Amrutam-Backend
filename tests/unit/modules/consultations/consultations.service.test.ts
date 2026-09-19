import { describe, it, expect, vi } from 'vitest';
import { ConsultationsService } from '../../../../src/modules/consultations/consultations.service';
import type { ConsultationsRepository } from '../../../../src/modules/consultations/consultations.repository';
import type { AuditService } from '../../../../src/modules/audit/audit.service';
import { ForbiddenError } from '../../../../src/common/errors';

function makeConsultation(status: string) {
  return { id: 'c-1', patientId: 'p-1', doctorId: 'd-1', slotId: 's-1', status, idempotencyKey: 'k-1' };
}

function makeRepoMock(initialStatus: string) {
  let current = makeConsultation(initialStatus);
  return {
    findById: vi.fn(async () => current),
    updateStatus: vi.fn(async (_id: string, status: string) => {
      current = { ...current, status };
      return current;
    }),
  } as unknown as ConsultationsRepository;
}

function makeAuditMock() {
  return { record: vi.fn(async () => undefined) } as unknown as AuditService;
}

describe('ConsultationsService.transition', () => {
  it('allows SCHEDULED -> IN_PROGRESS', async () => {
    const repo = makeRepoMock('SCHEDULED');
    const service = new ConsultationsService(repo, makeAuditMock());
    const result = await service.transition('c-1', 'd-1', 'IN_PROGRESS');
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('allows IN_PROGRESS -> COMPLETED', async () => {
    const repo = makeRepoMock('IN_PROGRESS');
    const service = new ConsultationsService(repo, makeAuditMock());
    const result = await service.transition('c-1', 'd-1', 'COMPLETED');
    expect(result.status).toBe('COMPLETED');
  });

  it('rejects SCHEDULED -> COMPLETED as an illegal transition', async () => {
    const repo = makeRepoMock('SCHEDULED');
    const service = new ConsultationsService(repo, makeAuditMock());
    await expect(service.transition('c-1', 'd-1', 'COMPLETED')).rejects.toThrow(/illegal|invalid transition/i);
  });

  it('rejects transitions out of a terminal state', async () => {
    const repo = makeRepoMock('COMPLETED');
    const service = new ConsultationsService(repo, makeAuditMock());
    await expect(service.transition('c-1', 'd-1', 'CANCELLED')).rejects.toThrow(/illegal|invalid transition/i);
  });

  it('writes an audit log on a successful transition', async () => {
    const repo = makeRepoMock('SCHEDULED');
    const audit = makeAuditMock();
    const service = new ConsultationsService(repo, audit);
    await service.transition('c-1', 'd-1', 'IN_PROGRESS');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CONSULTATION_STATUS_CHANGED', resourceType: 'Consultation' }),
    );
  });

  it('threads ipAddress through to the audit log', async () => {
    const repo = makeRepoMock('SCHEDULED');
    const audit = makeAuditMock();
    const service = new ConsultationsService(repo, audit);
    await service.transition('c-1', 'd-1', 'IN_PROGRESS', '203.0.113.5');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '203.0.113.5' }),
    );
  });

  describe('resource ownership', () => {
    it('allows the consultation\'s own patient to transition it', async () => {
      const repo = makeRepoMock('SCHEDULED');
      const service = new ConsultationsService(repo, makeAuditMock());
      const result = await service.transition('c-1', 'p-1', 'IN_PROGRESS');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('allows the consultation\'s own doctor to transition it', async () => {
      const repo = makeRepoMock('SCHEDULED');
      const service = new ConsultationsService(repo, makeAuditMock());
      const result = await service.transition('c-1', 'd-1', 'IN_PROGRESS');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('rejects an unrelated patient attempting to transition the consultation', async () => {
      const repo = makeRepoMock('SCHEDULED');
      const audit = makeAuditMock();
      const service = new ConsultationsService(repo, audit);
      await expect(service.transition('c-1', 'attacker-patient', 'CANCELLED')).rejects.toThrow(ForbiddenError);
      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rejects an unrelated doctor attempting to transition the consultation', async () => {
      const repo = makeRepoMock('SCHEDULED');
      const audit = makeAuditMock();
      const service = new ConsultationsService(repo, audit);
      await expect(service.transition('c-1', 'attacker-doctor', 'CANCELLED')).rejects.toThrow(ForbiddenError);
      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
