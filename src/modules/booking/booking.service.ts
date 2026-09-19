import type { BookingRepository } from './booking.repository';
import type { AuditService } from '../audit/audit.service';

export interface BookInput {
  patientId: string;
  doctorId: string;
  slotId: string;
  idempotencyKey: string;
  ipAddress?: string;
}

export class BookingService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly audit: AuditService,
  ) {}

  async book(input: BookInput) {
    const existing = await this.repo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const consultation = await this.repo.bookSlotTransactionally(input);

    await this.audit.record({
      actorId: input.patientId,
      action: 'CONSULTATION_BOOKED',
      resourceType: 'Consultation',
      resourceId: consultation.id,
      after: { status: consultation.status, slotId: consultation.slotId },
      ipAddress: input.ipAddress,
    });

    return consultation;
  }
}
