import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import type { AuthRepository } from '../../../../src/modules/auth/auth.repository';

function makeRepoMock() {
  const users = new Map<string, any>();
  return {
    createUser: vi.fn(async (data: any) => {
      const user = { id: 'user-1', ...data, mfaEnabled: false, mfaSecret: null };
      users.set(user.email, user);
      return user;
    }),
    findByEmail: vi.fn(async (email: string) => users.get(email) ?? null),
    findById: vi.fn(async (id: string) => [...users.values()].find((u) => u.id === id) ?? null),
    storeRefreshToken: vi.fn(async () => undefined),
  } as unknown as AuthRepository;
}

describe('AuthService', () => {
  let repo: ReturnType<typeof makeRepoMock>;
  let service: AuthService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
    repo = makeRepoMock();
    service = new AuthService(repo);
  });

  it('registers a new user and returns tokens', async () => {
    const result = await service.register({
      email: 'patient@example.com',
      password: 'CorrectHorseBatteryStaple1!',
      name: 'Pat Ient',
      role: 'PATIENT',
    });
    expect(result.user.email).toBe('patient@example.com');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(repo.createUser).toHaveBeenCalledOnce();
  });

  it('rejects registration with an already-used email', async () => {
    await service.register({
      email: 'dup@example.com',
      password: 'CorrectHorseBatteryStaple1!',
      name: 'Dup User',
      role: 'PATIENT',
    });
    await expect(
      service.register({
        email: 'dup@example.com',
        password: 'CorrectHorseBatteryStaple1!',
        name: 'Dup User 2',
        role: 'PATIENT',
      }),
    ).rejects.toThrow(/already/i);
  });

  it('logs in with correct credentials', async () => {
    await service.register({
      email: 'login@example.com',
      password: 'CorrectHorseBatteryStaple1!',
      name: 'Login User',
      role: 'PATIENT',
    });
    const result = await service.login({ email: 'login@example.com', password: 'CorrectHorseBatteryStaple1!' });
    expect('accessToken' in result).toBe(true);
  });

  it('rejects login with wrong password', async () => {
    await service.register({
      email: 'wrongpw@example.com',
      password: 'CorrectHorseBatteryStaple1!',
      name: 'WrongPw',
      role: 'PATIENT',
    });
    await expect(
      service.login({ email: 'wrongpw@example.com', password: 'not-the-password' }),
    ).rejects.toThrow(/invalid/i);
  });
});
