import { Router } from 'express';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsRepository } from './prescriptions.repository';
import { AuditService } from '../audit/audit.service';
import { AuditRepository } from '../audit/audit.repository';
import { prisma } from '../../common/db/prisma-client';
import { requireAuth, type AuthedRequest } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/rbac';
import { validate } from '../../common/middleware/validate';
import { writeRateLimiter } from '../../common/middleware/rate-limit';
import { issuePrescriptionSchema } from './prescriptions.schemas';

const service = new PrescriptionsService(
  new PrescriptionsRepository(prisma),
  new AuditService(new AuditRepository(prisma)),
);
export const prescriptionsRouter = Router();

prescriptionsRouter.post(
  '/consultations/:consultationId',
  requireAuth,
  requireRole('DOCTOR'),
  writeRateLimiter,
  validate(issuePrescriptionSchema, 'body'),
  async (req: AuthedRequest, res, next) => {
    try {
      const result = await service.issue(req.params.consultationId, req.user!.id, req.body, req.ip);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
