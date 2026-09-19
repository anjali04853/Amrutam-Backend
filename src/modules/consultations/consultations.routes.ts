import { Router } from 'express';
import { ConsultationsService } from './consultations.service';
import { ConsultationsRepository } from './consultations.repository';
import { AuditService } from '../audit/audit.service';
import { AuditRepository } from '../audit/audit.repository';
import { prisma } from '../../common/db/prisma-client';
import { requireAuth, type AuthedRequest } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/rbac';
import { validate } from '../../common/middleware/validate';
import { writeRateLimiter } from '../../common/middleware/rate-limit';
import { transitionSchema } from './consultations.schemas';

const service = new ConsultationsService(new ConsultationsRepository(prisma), new AuditService(new AuditRepository(prisma)));
export const consultationsRouter = Router();

consultationsRouter.patch(
  '/:id/status',
  requireAuth,
  requireRole('DOCTOR', 'PATIENT'),
  writeRateLimiter,
  validate(transitionSchema, 'body'),
  async (req: AuthedRequest, res, next) => {
    try {
      const result = await service.transition(req.params.id, req.user!.id, req.body.status, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
