import { Router } from 'express';
import { BookingService } from './booking.service';
import { BookingRepository } from './booking.repository';
import { AuditService } from '../audit/audit.service';
import { AuditRepository } from '../audit/audit.repository';
import { prisma } from '../../common/db/prisma-client';
import { requireAuth, type AuthedRequest } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/rbac';
import { validate } from '../../common/middleware/validate';
import { requireIdempotencyKey, type IdempotentRequest } from '../../common/middleware/idempotency';
import { writeRateLimiter } from '../../common/middleware/rate-limit';
import { createBookingSchema } from './booking.schemas';

const service = new BookingService(new BookingRepository(prisma), new AuditService(new AuditRepository(prisma)));
export const bookingRouter = Router();

bookingRouter.post(
  '/',
  requireAuth,
  requireRole('PATIENT'),
  writeRateLimiter,
  requireIdempotencyKey,
  validate(createBookingSchema, 'body'),
  async (req: AuthedRequest & IdempotentRequest, res, next) => {
    try {
      const result = await service.book({
        patientId: req.user!.id,
        doctorId: req.body.doctorId,
        slotId: req.body.slotId,
        idempotencyKey: req.idempotencyKey!,
        ipAddress: req.ip,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
