import type { ConsultationsRepository } from './consultations.repository';
import type { AuditService } from '../audit/audit.service';
import { ForbiddenError, ValidationError } from '../../common/errors';

type Status = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export class ConsultationsService {
  constructor(
    private readonly repo: ConsultationsRepository,
    private readonly audit: AuditService,
  ) {}

  async transition(consultationId: string, actorId: string, toStatus: Status, ipAddress?: string) {
    const current = await this.repo.findById(consultationId);
    if (actorId !== current.patientId && actorId !== current.doctorId) {
      throw new ForbiddenError('You do not have access to this consultation');
    }
    const fromStatus = current.status as Status;
    const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ValidationError(`Illegal transition from ${fromStatus} to ${toStatus}`);
    }
    const updated = await this.repo.updateStatus(consultationId, toStatus);
    await this.audit.record({
      actorId,
      action: 'CONSULTATION_STATUS_CHANGED',
      resourceType: 'Consultation',
      resourceId: consultationId,
      before: { status: fromStatus },
      after: { status: toStatus },
      ipAddress,
    });
    return updated;
  }
}
