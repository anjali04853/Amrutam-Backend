import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireRole } from '../../../../src/common/middleware/rbac';

describe('requireRole middleware', () => {
  it('allows a matching role through', () => {
    const mw = requireRole('DOCTOR', 'ADMIN');
    const req = { user: { id: 'u1', role: 'DOCTOR' } } as unknown as Request;
    const next = vi.fn();
    mw(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a non-matching role with ForbiddenError', () => {
    const mw = requireRole('ADMIN');
    const req = { user: { id: 'u1', role: 'PATIENT' } } as unknown as Request;
    const next = vi.fn();
    mw(req, {} as Response, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });
});
