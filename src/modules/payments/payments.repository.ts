import type { PrismaClient, Payment, Consultation, Doctor } from '@prisma/client';
import { NotFoundError } from '../../common/errors';

export class PaymentsRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { idempotencyKey } });
  }

  async findConsultation(consultationId: string): Promise<Consultation> {
    const consultation = await this.db.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new NotFoundError('Consultation not found');
    return consultation;
  }

  async findDoctor(doctorId: string): Promise<Doctor> {
    const doctor = await this.db.doctor.findUnique({ where: { userId: doctorId } });
    if (!doctor) throw new NotFoundError('Doctor not found');
    return doctor;
  }

  async createPending(data: {
    consultationId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<Payment> {
    return this.db.payment.create({
      data: { ...data, status: 'PENDING' },
    });
  }

  async markSucceeded(id: string, providerRef: string): Promise<Payment> {
    return this.db.payment.update({ where: { id }, data: { status: 'SUCCEEDED', providerRef } });
  }

  async markFailed(id: string): Promise<Payment> {
    return this.db.payment.update({ where: { id }, data: { status: 'FAILED' } });
  }
}
