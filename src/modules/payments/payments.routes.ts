import { Router } from 'express';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { MockPaymentGateway } from './payment-gateway';
import { BookingRepository } from '../booking/booking.repository';
import { AuditService } from '../audit/audit.service';
import { AuditRepository } from '../audit/audit.repository';
import { prisma } from '../../common/db/prisma-client';
import { requireAuth, type AuthedRequest } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/rbac';
import { validate } from '../../common/middleware/validate';
import { requireIdempotencyKey, type IdempotentRequest } from '../../common/middleware/idempotency';
import { writeRateLimiter } from '../../common/middleware/rate-limit';
import { createPaymentSchema } from './payments.schemas';
import { loadEnv } from '../../config/env';

const service = new PaymentsService(
  new PaymentsRepository(prisma),
  new MockPaymentGateway(),
  new BookingRepository(prisma),
  new AuditService(new AuditRepository(prisma)),
);
export const paymentsRouter = Router();

paymentsRouter.post(
  '/',
  requireAuth,
  requireRole('PATIENT'),
  writeRateLimiter,
  requireIdempotencyKey,
  validate(createPaymentSchema, 'body'),
  async (req: AuthedRequest & IdempotentRequest, res, next) => {
    try {
      // forceOutcome is a demo/test-only escape hatch for exercising the saga
      // end-to-end without a real payment gateway. It must never be reachable
      // in production, so it is stripped from the input entirely outside
      // non-production environments regardless of what the client sends.
      const isProduction = loadEnv().NODE_ENV === 'production';
      const result = await service.pay({
        consultationId: req.body.consultationId,
        actorId: req.user!.id,
        idempotencyKey: req.idempotencyKey!,
        forceOutcome: isProduction ? undefined : req.body.forceOutcome,
        ipAddress: req.ip,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
