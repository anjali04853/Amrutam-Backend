import { Router } from 'express';
import { z } from 'zod';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { prisma } from '../../common/db/prisma-client';
import { requireAuth } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/rbac';
import { validate } from '../../common/middleware/validate';
import { readRateLimiter } from '../../common/middleware/rate-limit';

const service = new AdminService(new AdminRepository(prisma));
export const adminRouter = Router();

const analyticsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

adminRouter.get(
  '/analytics',
  requireAuth,
  requireRole('ADMIN'),
  readRateLimiter,
  validate(analyticsQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { from, to } = req.query as unknown as { from: string; to: string };
      const result = await service.getDailyAnalytics(new Date(from), new Date(to));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
