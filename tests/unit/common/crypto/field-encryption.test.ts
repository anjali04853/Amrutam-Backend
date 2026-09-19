import { describe, it, expect, beforeEach } from 'vitest';
import { resetEnvCacheForTests } from '../../../../src/config/env';

describe('field encryption', () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.REDIS_URL = 'redis://test';
    process.env.JWT_ACCESS_SECRET = 'b'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'c'.repeat(32);
  });

  it('encrypts and decrypts round-trip', async () => {
    const { encryptField, decryptField } = await import('../../../../src/common/crypto/field-encryption');
    const plaintext = '+1-555-0100';
    const ciphertext = encryptField(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.split(':')).toHaveLength(3);
    expect(decryptField(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext each call (random IV)', async () => {
    const { encryptField } = await import('../../../../src/common/crypto/field-encryption');
    const a = encryptField('same-value');
    const b = encryptField('same-value');
    expect(a).not.toBe(b);
  });

  it('throws on tampered ciphertext', async () => {
    const { encryptField, decryptField } = await import('../../../../src/common/crypto/field-encryption');
    const ciphertext = encryptField('secret');
    const tampered = ciphertext.slice(0, -2) + 'ff';
    expect(() => decryptField(tampered)).toThrow();
  });
});
