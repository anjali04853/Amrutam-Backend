import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../../../src/modules/booking/booking.service';
import type { BookingRepository } from '../../../../src/modules/booking/booking.repository';
import type { AuditService } from '../../../../src/modules/audit/audit.service';

function makeRepoMock() {
  return {
    findByIdempotencyKey: vi.fn(async () => null),
    bookSlotTransactionally: vi.fn(async () => ({
      id: 'consult-1',
      patientId: 'patient-1',
      doctorId: 'doc-1',
      slotId: 'slot-1',
      status: 'SCHEDULED',
      idempotencyKey: 'idem-1',
    })),
  } as unknown as BookingRepository;
}

function makeAuditMock() {
  return { record: vi.fn(async () => undefined) } as unknown as AuditService;
}

describe('BookingService', () => {
  let repo: ReturnType<typeof makeRepoMock>;
  let audit: ReturnType<typeof makeAuditMock>;
  let service: BookingService;

  beforeEach(() => {
    repo = makeRepoMock();
    audit = makeAuditMock();
    service = new BookingService(repo, audit);
  });

  it('books a slot and writes an audit log', async () => {
    const result = await service.book({
      patientId: 'patient-1',
      doctorId: 'doc-1',
      slotId: 'slot-1',
      idempotencyKey: 'idem-1',
    });
    expect(result.id).toBe('consult-1');
    expect(repo.bookSlotTransactionally).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CONSULTATION_BOOKED', resourceType: 'Consultation' }),
    );
  });

  it('returns the existing consultation on idempotency key replay without re-booking', async () => {
    repo.findByIdempotencyKey = vi.fn(async () => ({
      id: 'consult-existing',
      patientId: 'patient-1',
      doctorId: 'doc-1',
      slotId: 'slot-1',
      status: 'SCHEDULED',
      idempotencyKey: 'idem-1',
    })) as never;

    const result = await service.book({
      patientId: 'patient-1',
      doctorId: 'doc-1',
      slotId: 'slot-1',
      idempotencyKey: 'idem-1',
    });

    expect(result.id).toBe('consult-existing');
    expect(repo.bookSlotTransactionally).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('propagates ConflictError when the repository reports the slot is unavailable', async () => {
    const { ConflictError } = await import('../../../../src/common/errors');
    repo.bookSlotTransactionally = vi.fn(async () => {
      throw new ConflictError('Slot is no longer available');
    }) as never;

    await expect(
      service.book({ patientId: 'patient-1', doctorId: 'doc-1', slotId: 'slot-1', idempotencyKey: 'idem-2' }),
    ).rejects.toThrow(/no longer available/i);
  });
});
