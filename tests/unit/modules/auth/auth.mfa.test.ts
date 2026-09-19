import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import type { AuthRepository } from '../../../../src/modules/auth/auth.repository';

function makeRepoMock() {
  const user: any = {
    id: 'user-1',
    email: 'mfa@example.com',
    role: 'PATIENT',
    mfaEnabled: false,
    mfaSecret: null,
    passwordHash: bcrypt.hashSync('correct-horse-battery-staple', 12),
  };
  return {
    findById: vi.fn(async () => user),
    findByEmail: vi.fn(async () => user),
    setMfaSecret: vi.fn(async (_id: string, encSecret: string) => {
      user.mfaSecret = encSecret;
    }),
    enableMfa: vi.fn(async () => {
      user.mfaEnabled = true;
    }),
    storeRefreshToken: vi.fn(async () => undefined),
    isRefreshTokenValid: vi.fn(async () => true),
    revokeRefreshToken: vi.fn(async () => undefined),
    _user: user,
  } as unknown as AuthRepository & { _user: any };
}

describe('AuthService MFA', () => {
  let repo: ReturnType<typeof makeRepoMock>;
  let service: AuthService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
    repo = makeRepoMock();
    service = new AuthService(repo);
  });

  it('enrolls MFA and returns a secret + otpauth URL', async () => {
    const result = await service.enrollMfa('user-1');
    expect(result.secret).toBeTruthy();
    expect(result.otpauthUrl).toContain('otpauth://');
    expect(repo.setMfaSecret).toHaveBeenCalledOnce();
  });

  it('confirms MFA with a valid TOTP code and enables it', async () => {
    const { secret } = await service.enrollMfa('user-1');
    const code = authenticator.generate(secret);
    await service.confirmMfa('user-1', code);
    expect(repo.enableMfa).toHaveBeenCalledWith('user-1');
  });

  it('rejects MFA confirmation with an invalid code', async () => {
    await service.enrollMfa('user-1');
    await expect(service.confirmMfa('user-1', '000000')).rejects.toThrow(/invalid/i);
  });

  it('logs in successfully with a valid TOTP code after MFA is enrolled and confirmed', async () => {
    const { secret } = await service.enrollMfa('user-1');
    const enrollCode = authenticator.generate(secret);
    await service.confirmMfa('user-1', enrollCode);
    expect(repo._user.mfaEnabled).toBe(true);

    const loginCode = authenticator.generate(secret);
    const result = await service.login({
      email: 'mfa@example.com',
      password: 'correct-horse-battery-staple',
      totpCode: loginCode,
    });

    expect('mfaRequired' in result).toBe(false);
    if ('mfaRequired' in result) throw new Error('unreachable');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.id).toBe('user-1');
  });
});
