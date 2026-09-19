import type { PrismaClient, Consultation, Prescription } from '@prisma/client';
import { NotFoundError } from '../../common/errors';

export class PrescriptionsRepository {
  constructor(private readonly db: PrismaClient) {}

  async findConsultation(consultationId: string): Promise<Consultation> {
    const consultation = await this.db.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new NotFoundError('Consultation not found');
    return consultation;
  }

  async create(data: { consultationId: string; doctorId: string; content: unknown }): Promise<Prescription> {
    return this.db.prescription.create({
      data: { consultationId: data.consultationId, doctorId: data.doctorId, content: data.content as never },
    });
  }
}
