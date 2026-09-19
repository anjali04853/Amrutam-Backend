import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireIdempotencyKey } from '../../../../src/common/middleware/idempotency';

describe('requireIdempotencyKey', () => {
  it('attaches the key and calls next when header present', () => {
    const req = { headers: { 'idempotency-key': 'abc-123' } } as unknown as Request;
    const next = vi.fn();
    requireIdempotencyKey(req, {} as Response, next);
    expect((req as any).idempotencyKey).toBe('abc-123');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with ValidationError when header missing', () => {
    const req = { headers: {} } as unknown as Request;
    const next = vi.fn();
    requireIdempotencyKey(req, {} as Response, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
  });
});
