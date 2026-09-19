import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { logger } from '../../observability/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn({ err, path: req.path, code: err.code }, 'handled application error');
    res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
    return;
  }
  logger.error({ err, path: req.path }, 'unhandled error');
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
}
