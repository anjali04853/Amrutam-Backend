import { Router } from 'express';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { prisma } from '../../common/db/prisma-client';
import { validate } from '../../common/middleware/validate';
import { requireAuth, type AuthedRequest } from '../../common/middleware/auth';
import { authRateLimiter } from '../../common/middleware/rate-limit';
import { registerSchema, loginSchema, mfaConfirmSchema, refreshSchema } from './auth.schemas';

const service = new AuthService(new AuthRepository(prisma));
export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate(registerSchema, 'body'), async (req, res, next) => {
  try {
    const result = await service.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authRateLimiter, validate(loginSchema, 'body'), async (req, res, next) => {
  try {
    const result = await service.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/mfa/enroll', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const result = await service.enrollMfa(req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/mfa/confirm', requireAuth, validate(mfaConfirmSchema, 'body'), async (req: AuthedRequest, res, next) => {
  try {
    await service.confirmMfa(req.user!.id, req.body.code);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', validate(refreshSchema, 'body'), async (req, res, next) => {
  try {
    const result = await service.refresh(req.body.refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', validate(refreshSchema, 'body'), async (req, res, next) => {
  try {
    await service.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
