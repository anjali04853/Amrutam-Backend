import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { validate } from '../../../../src/common/middleware/validate';

describe('validate middleware', () => {
  const schema = z.object({ email: z.string().email() });

  it('passes through valid body and normalizes it', () => {
    const mw = validate(schema, 'body');
    const req = { body: { email: 'a@b.com' } } as unknown as Request;
    const next = vi.fn();
    mw(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@b.com' });
  });

  it('calls next with ValidationError for invalid body', () => {
    const mw = validate(schema, 'body');
    const req = { body: { email: 'not-an-email' } } as unknown as Request;
    const next = vi.fn();
    mw(req, {} as Response, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
  });
});
