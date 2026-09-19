import type { PrescriptionsRepository } from './prescriptions.repository';
import type { AuditService } from '../audit/audit.service';
import { getQueue } from '../../jobs/queue';
import { ForbiddenError, ValidationError } from '../../common/errors';

export interface PrescriptionContent {
  medicines: { name: string; dosage: string }[];
  notes?: string;
}

export class PrescriptionsService {
  constructor(
    private readonly repo: PrescriptionsRepository,
    private readonly audit: AuditService,
  ) {}

  async issue(
    consultationId: string,
    doctorId: string,
    content: PrescriptionContent,
    ipAddress?: string,
  ) {
    const consultation = await this.repo.findConsultation(consultationId);
    if (doctorId !== consultation.doctorId) {
      throw new ForbiddenError('You are not the assigned doctor for this consultation');
    }
    if (consultation.status !== 'COMPLETED') {
      throw new ValidationError('Prescriptions can only be issued for a completed consultation');
    }
    const prescription = await this.repo.create({ consultationId, doctorId, content });

    await this.audit.record({
      actorId: doctorId,
      action: 'PRESCRIPTION_ISSUED',
      resourceType: 'Prescription',
      resourceId: prescription.id,
      after: { consultationId, doctorId },
      ipAddress,
    });

    await getQueue('pdf-generation').add('generate', { prescriptionId: prescription.id });
    await getQueue('notifications').add('prescription-issued', {
      consultationId,
      patientId: consultation.patientId,
      prescriptionId: prescription.id,
    });

    return prescription;
  }
}
