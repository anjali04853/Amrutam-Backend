import type { PrismaClient, Consultation, ConsultationStatus } from '@prisma/client';
import { NotFoundError } from '../../common/errors';

export class ConsultationsRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<Consultation> {
    const consultation = await this.db.consultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundError('Consultation not found');
    return consultation;
  }

  async updateStatus(id: string, status: ConsultationStatus): Promise<Consultation> {
    return this.db.consultation.update({ where: { id }, data: { status } });
  }
}
