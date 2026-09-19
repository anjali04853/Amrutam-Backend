import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnv, resetEnvCacheForTests } from '../../../src/config/env';

describe('loadEnv', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('parses valid env vars into typed config', () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.ENCRYPTION_KEY = 'c'.repeat(64);
    process.env.LOG_LEVEL = 'info';

    const cfg = loadEnv();
    expect(cfg.PORT).toBe(3000);
    expect(cfg.NODE_ENV).toBe('test');
  });

  it('throws when a required var is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => loadEnv()).toThrow();
  });
});
