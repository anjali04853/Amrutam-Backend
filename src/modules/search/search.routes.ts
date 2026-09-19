import { Router } from 'express';
import { SearchService } from './search.service';
import { SearchRepository } from './search.repository';
import { prisma } from '../../common/db/prisma-client';
import { getRedisClient } from '../../common/redis-client';
import { requireAuth } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { readRateLimiter } from '../../common/middleware/rate-limit';
import { searchQuerySchema } from './search.schemas';

const service = new SearchService(new SearchRepository(prisma), getRedisClient());
export const searchRouter = Router();

searchRouter.get('/doctors', requireAuth, readRateLimiter, validate(searchQuerySchema, 'query'), async (req, res, next) => {
  try {
    const result = await service.searchDoctors(req.query as never);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
