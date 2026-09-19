import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { signAccessToken } from '../../../../src/modules/auth/jwt';

describe('requireAuth middleware', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('attaches req.user for a valid bearer token', async () => {
    const { requireAuth } = await import('../../../../src/common/middleware/auth');
    const token = signAccessToken('user-1', 'PATIENT');
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    requireAuth(req, res, next);

    expect((req as any).user).toEqual({ id: 'user-1', role: 'PATIENT' });
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with UnauthorizedError when header is missing', async () => {
    const { requireAuth } = await import('../../../../src/common/middleware/auth');
    const req = { headers: {} } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});
