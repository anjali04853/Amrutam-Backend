import type { PrismaClient, Consultation } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../common/errors';

export class BookingRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<Consultation | null> {
    return this.db.consultation.findUnique({ where: { idempotencyKey } });
  }

  async bookSlotTransactionally(input: {
    patientId: string;
    doctorId: string;
    slotId: string;
    idempotencyKey: string;
  }): Promise<Consultation> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; status: string; startTime: Date }[]>`
        SELECT id, status, "startTime" FROM availability_slots
        WHERE id = ${input.slotId} AND "doctorId" = ${input.doctorId}
        FOR UPDATE
      `;
      const slot = rows[0];
      if (!slot) {
        throw new NotFoundError('Availability slot not found');
      }
      if (slot.status !== 'OPEN') {
        throw new ConflictError('Slot is no longer available');
      }

      await tx.availabilitySlot.update({
        where: { id: input.slotId },
        data: { status: 'BOOKED', version: { increment: 1 } },
      });

      return tx.consultation.create({
        data: {
          patientId: input.patientId,
          doctorId: input.doctorId,
          slotId: input.slotId,
          scheduledAt: slot.startTime,
          idempotencyKey: input.idempotencyKey,
          status: 'SCHEDULED',
        },
      });
    });
  }

  async releaseSlot(slotId: string): Promise<void> {
    await this.db.availabilitySlot.update({
      where: { id: slotId },
      data: { status: 'OPEN', version: { increment: 1 } },
    });
  }
}
