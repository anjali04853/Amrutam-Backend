import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../redis-client';

export function makeRateLimiter(opts: { windowMs: number; max: number; prefix: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      prefix: opts.prefix,
      sendCommand: (...args: string[]) =>
        getRedisClient().call(...(args as [string, ...string[]])) as never,
    }),
  });
}

export const authRateLimiter = makeRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, prefix: 'rl:auth:' });
export const readRateLimiter = makeRateLimiter({ windowMs: 60 * 1000, max: 300, prefix: 'rl:read:' });
export const writeRateLimiter = makeRateLimiter({ windowMs: 60 * 1000, max: 60, prefix: 'rl:write:' });
