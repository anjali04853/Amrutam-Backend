import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors';

export interface IdempotentRequest extends Request {
  idempotencyKey?: string;
}

export function requireIdempotencyKey(req: IdempotentRequest, _res: Response, next: NextFunction): void {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string') {
    next(new ValidationError('Idempotency-Key header is required'));
    return;
  }
  req.idempotencyKey = key;
  next();
}
