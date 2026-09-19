import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../errors';

export function validate(schema: ZodSchema, part: 'body' | 'query' | 'params') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new ValidationError('Invalid request', result.error.flatten()));
      return;
    }
    req[part] = result.data;
    next();
  };
}
