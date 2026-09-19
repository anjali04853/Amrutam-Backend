import { Prisma } from '@prisma/client';
import type { PaymentsRepository } from './payments.repository';
import type { MockPaymentGateway, ChargeOptions } from './payment-gateway';
import type { AuditService } from '../audit/audit.service';
import type { BookingRepository } from '../booking/booking.repository';
import { retryWithBackoff } from '../../common/retry';
import { logger } from '../../observability/logger';
import { ConflictError, ForbiddenError } from '../../common/errors';

export interface PayInput {
  consultationId: string;
  actorId: string;
  idempotencyKey: string;
  forceOutcome?: ChargeOptions['forceOutcome'];
  ipAddress?: string;
}

export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly gateway: MockPaymentGateway,
    private readonly bookingRepo: BookingRepository,
    private readonly audit: AuditService,
  ) {}

  async pay(input: PayInput) {
    const existing = await this.repo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const consultation = await this.repo.findConsultation(input.consultationId);
    if (input.actorId !== consultation.patientId) {
      throw new ForbiddenError('You do not have access to this consultation');
    }

    // Amount is always derived server-side from the doctor's consultation fee —
    // never client-supplied — so a patient cannot control what they are charged.
    const doctor = await this.repo.findDoctor(consultation.doctorId);
    const amount = Number(doctor.consultationFee);

    let payment;
    try {
      payment = await this.repo.createPending({
        consultationId: input.consultationId,
        amount,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Unique constraint on consultationId (or idempotencyKey): a payment already
        // exists for this consultation. Fail cleanly instead of a raw 500 — this is
        // a distinct, already-recorded conflict, not a gateway failure to compensate.
        throw new ConflictError('A payment already exists for this consultation');
      }
      throw err;
    }

    try {
      const { providerRef } = await retryWithBackoff(
        () => this.gateway.charge(amount, { forceOutcome: input.forceOutcome }),
        { attempts: 3, baseDelayMs: 200 },
      );
      const succeeded = await this.repo.markSucceeded(payment.id, providerRef);
      await this.audit.record({
        actorId: consultation.patientId,
        action: 'PAYMENT_SUCCEEDED',
        resourceType: 'Payment',
        resourceId: payment.id,
        after: { status: 'SUCCEEDED', providerRef },
        ipAddress: input.ipAddress,
      });
      return succeeded;
    } catch (err) {
      try {
        await this.repo.markFailed(payment.id);
        await this.bookingRepo.releaseSlot(consultation.slotId);
        await this.audit.record({
          actorId: consultation.patientId,
          action: 'BOOKING_COMPENSATED_SLOT_RELEASED',
          resourceType: 'AvailabilitySlot',
          resourceId: consultation.slotId,
          after: { reason: 'payment_failed', paymentId: payment.id },
          ipAddress: input.ipAddress,
        });
      } catch (compensationErr) {
        logger.error(
          { compensationErr, paymentId: payment.id, slotId: consultation.slotId },
          'saga compensation step failed',
        );
      }
      throw err;
    }
  }
}
