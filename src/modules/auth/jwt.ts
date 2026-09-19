import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { loadEnv } from '../../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, loadEnv().JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, loadEnv().JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, jti: randomUUID() }, loadEnv().JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, loadEnv().JWT_REFRESH_SECRET) as { sub: string };
}
