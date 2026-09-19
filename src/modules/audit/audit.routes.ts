import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/db/prisma-client';
import { requireAuth } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/rbac';
import { validate } from '../../common/middleware/validate';
import { readRateLimiter } from '../../common/middleware/rate-limit';

export const auditRouter = Router();

const auditQuerySchema = z.object({
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  actorId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

auditRouter.get(
  '/audit-logs',
  requireAuth,
  requireRole('ADMIN'),
  readRateLimiter,
  validate(auditQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { resourceType, resourceId, actorId, limit } = req.query as unknown as {
        resourceType?: string;
        resourceId?: string;
        actorId?: string;
        limit: number;
      };
      const logs = await prisma.auditLog.findMany({
        where: { resourceType, resourceId, actorId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      res.status(200).json(logs);
    } catch (err) {
      next(err);
    }
  },
);
