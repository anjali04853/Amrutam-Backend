import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { PaymentsService } from '../../../../src/modules/payments/payments.service';
import type { PaymentsRepository } from '../../../../src/modules/payments/payments.repository';
import type { MockPaymentGateway } from '../../../../src/modules/payments/payment-gateway';
import type { AuditService } from '../../../../src/modules/audit/audit.service';
import type { BookingRepository } from '../../../../src/modules/booking/booking.repository';
import { PaymentGatewayError } from '../../../../src/modules/payments/payment-gateway';
import { ForbiddenError, ConflictError } from '../../../../src/common/errors';

function makePaymentsRepoMock() {
  return {
    findByIdempotencyKey: vi.fn(async () => null),
    findConsultation: vi.fn(async () => ({ id: 'c-1', slotId: 'slot-1', patientId: 'p-1', doctorId: 'd-1' })),
    findDoctor: vi.fn(async () => ({ userId: 'd-1', consultationFee: 500 })),
    createPending: vi.fn(async (data: any) => ({ id: 'pay-1', status: 'PENDING', ...data })),
    markSucceeded: vi.fn(async (id: string, providerRef: string) => ({ id, status: 'SUCCEEDED', providerRef })),
    markFailed: vi.fn(async (id: string) => ({ id, status: 'FAILED' })),
  } as unknown as PaymentsRepository;
}

function makeAuditMock() {
  return { record: vi.fn(async () => undefined) } as unknown as AuditService;
}

function makeBookingRepoMock() {
  return { releaseSlot: vi.fn(async () => undefined) } as unknown as BookingRepository;
}

describe('PaymentsService.pay', () => {
  let paymentsRepo: ReturnType<typeof makePaymentsRepoMock>;
  let bookingRepo: ReturnType<typeof makeBookingRepoMock>;
  let audit: ReturnType<typeof makeAuditMock>;

  beforeEach(() => {
    paymentsRepo = makePaymentsRepoMock();
    bookingRepo = makeBookingRepoMock();
    audit = makeAuditMock();
  });

  it('succeeds and marks the payment SUCCEEDED, charging the doctor\'s consultationFee', async () => {
    const gateway = { charge: vi.fn(async () => ({ providerRef: 'ref-1' })) } as unknown as MockPaymentGateway;
    const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

    const result = await service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-1' });

    expect(result.status).toBe('SUCCEEDED');
    expect(paymentsRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500 }),
    );
    expect(gateway.charge).toHaveBeenCalledWith(500, expect.anything());
    expect(paymentsRepo.markSucceeded).toHaveBeenCalledWith('pay-1', 'ref-1');
    expect(bookingRepo.releaseSlot).not.toHaveBeenCalled();
  });

  it('ignores any client-supplied amount and always uses the doctor\'s consultationFee', async () => {
    paymentsRepo.findDoctor = vi.fn(async () => ({ userId: 'd-1', consultationFee: 750 })) as never;
    const gateway = { charge: vi.fn(async () => ({ providerRef: 'ref-1' })) } as unknown as MockPaymentGateway;
    const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

    // PayInput has no `amount` field at all — the type system itself prevents a caller
    // from supplying one. The charged amount must equal the doctor's fee (750), not
    // anything the caller might try to smuggle in.
    await service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-1b' });

    expect(gateway.charge).toHaveBeenCalledWith(750, expect.anything());
    expect(paymentsRepo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 750 }),
    );
  });

  it('compensates by releasing the slot when the gateway fails after retries', async () => {
    const gateway = {
      charge: vi.fn(async () => {
        throw new PaymentGatewayError('declined');
      }),
    } as unknown as MockPaymentGateway;
    const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

    await expect(
      service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-2', forceOutcome: 'fail' }),
    ).rejects.toThrow(PaymentGatewayError);

    expect(paymentsRepo.markFailed).toHaveBeenCalledWith('pay-1');
    expect(bookingRepo.releaseSlot).toHaveBeenCalledWith('slot-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BOOKING_COMPENSATED_SLOT_RELEASED' }),
    );
  });

  it('still throws the original gateway error when the compensation step itself fails', async () => {
    const gateway = {
      charge: vi.fn(async () => {
        throw new PaymentGatewayError('declined');
      }),
    } as unknown as MockPaymentGateway;
    bookingRepo.releaseSlot = vi.fn(async () => {
      throw new Error('transient DB error during releaseSlot');
    });
    const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

    await expect(
      service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-4', forceOutcome: 'fail' }),
    ).rejects.toThrow(PaymentGatewayError);

    expect(paymentsRepo.markFailed).toHaveBeenCalledWith('pay-1');
    expect(bookingRepo.releaseSlot).toHaveBeenCalledWith('slot-1');
  });

  it('returns the existing payment on idempotency key replay', async () => {
    paymentsRepo.findByIdempotencyKey = vi.fn(async () => ({ id: 'pay-existing', status: 'SUCCEEDED' })) as never;
    const gateway = { charge: vi.fn() } as unknown as MockPaymentGateway;
    const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

    const result = await service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-3' });

    expect(result.id).toBe('pay-existing');
    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('threads ipAddress through to the audit log on success', async () => {
    const gateway = { charge: vi.fn(async () => ({ providerRef: 'ref-1' })) } as unknown as MockPaymentGateway;
    const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

    await service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-5', ipAddress: '203.0.113.5' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_SUCCEEDED', ipAddress: '203.0.113.5' }),
    );
  });

  describe('resource ownership', () => {
    it('allows the consultation\'s own patient to pay', async () => {
      const gateway = { charge: vi.fn(async () => ({ providerRef: 'ref-1' })) } as unknown as MockPaymentGateway;
      const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

      const result = await service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-owner' });
      expect(result.status).toBe('SUCCEEDED');
    });

    it('rejects an unrelated patient attempting to pay for someone else\'s consultation', async () => {
      const gateway = { charge: vi.fn() } as unknown as MockPaymentGateway;
      const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

      await expect(
        service.pay({ consultationId: 'c-1', actorId: 'attacker-patient', idempotencyKey: 'pay-key-attacker' }),
      ).rejects.toThrow(ForbiddenError);

      expect(paymentsRepo.createPending).not.toHaveBeenCalled();
      expect(gateway.charge).not.toHaveBeenCalled();
    });
  });

  describe('duplicate payment on the same consultation (I2)', () => {
    it('returns a clean ConflictError when createPending hits the unique-constraint on consultationId', async () => {
      const gateway = { charge: vi.fn() } as unknown as MockPaymentGateway;
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['consultationId'] },
      });
      paymentsRepo.createPending = vi.fn(async () => {
        throw p2002;
      }) as never;
      const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

      await expect(
        service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-dup' }),
      ).rejects.toThrow(ConflictError);

      // No gateway call and no compensation should occur — this is a distinct,
      // already-recorded conflict, not a gateway failure.
      expect(gateway.charge).not.toHaveBeenCalled();
      expect(bookingRepo.releaseSlot).not.toHaveBeenCalled();
    });

    it('rethrows other Prisma errors from createPending unchanged', async () => {
      const gateway = { charge: vi.fn() } as unknown as MockPaymentGateway;
      const otherError = new Prisma.PrismaClientKnownRequestError('Some other failure', {
        code: 'P2025',
        clientVersion: 'test',
      });
      paymentsRepo.createPending = vi.fn(async () => {
        throw otherError;
      }) as never;
      const service = new PaymentsService(paymentsRepo, gateway, bookingRepo, audit);

      await expect(
        service.pay({ consultationId: 'c-1', actorId: 'p-1', idempotencyKey: 'pay-key-other' }),
      ).rejects.toBe(otherError);
    });
  });
});
