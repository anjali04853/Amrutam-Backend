import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth';
import { ForbiddenError } from '../errors';

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
