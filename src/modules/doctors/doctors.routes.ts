import { Router } from 'express';
import { DoctorsService } from './doctors.service';
import { DoctorsRepository } from './doctors.repository';
import { prisma } from '../../common/db/prisma-client';
import { requireAuth, type AuthedRequest } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/rbac';
import { validate } from '../../common/middleware/validate';
import { writeRateLimiter, readRateLimiter } from '../../common/middleware/rate-limit';
import { doctorProfileSchema, addAvailabilitySchema, listAvailabilityQuerySchema } from './doctors.schemas';

const service = new DoctorsService(new DoctorsRepository(prisma));
export const doctorsRouter = Router();

doctorsRouter.post(
  '/me/profile',
  requireAuth,
  requireRole('DOCTOR'),
  writeRateLimiter,
  validate(doctorProfileSchema, 'body'),
  async (req: AuthedRequest, res, next) => {
    try {
      const result = await service.createProfile(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

doctorsRouter.post(
  '/me/availability',
  requireAuth,
  requireRole('DOCTOR'),
  writeRateLimiter,
  validate(addAvailabilitySchema, 'body'),
  async (req: AuthedRequest, res, next) => {
    try {
      const result = await service.addAvailability(req.user!.id, req.body.slots);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

doctorsRouter.get(
  '/:doctorId/availability',
  requireAuth,
  readRateLimiter,
  validate(listAvailabilityQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { from, to } = req.query as unknown as { from: string; to: string };
      const result = await service.listAvailability(req.params.doctorId, new Date(from), new Date(to));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
