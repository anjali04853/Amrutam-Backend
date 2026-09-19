import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import type { AuthRepository } from './auth.repository';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt';
import type { RegisterInput, LoginInput, LoginResult, PublicUser } from './auth.types';
import { encryptField, decryptField } from '../../common/crypto/field-encryption';
import { ConflictError, UnauthorizedError, ValidationError, NotFoundError } from '../../common/errors';

const BCRYPT_ROUNDS = 12;

function toPublicUser(user: { id: string; email: string; role: string }): PublicUser {
  return { id: user.id, email: user.email, role: user.role };
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async register(input: RegisterInput): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.repo.createUser({
      email: input.email,
      passwordHash,
      role: input.role,
      name: input.name,
    });
    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id);
    await this.repo.storeRefreshToken(user.id, refreshToken, new Date(Date.now() + 30 * 24 * 3600 * 1000));
    return { user: toPublicUser(user), accessToken, refreshToken };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.repo.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (user.mfaEnabled) {
      if (!input.totpCode) {
        return { mfaRequired: true, userId: user.id };
      }
      if (!user.mfaSecret) {
        throw new UnauthorizedError('Invalid MFA code');
      }
      const secret = decryptField(user.mfaSecret);
      if (!authenticator.check(input.totpCode, secret)) {
        throw new UnauthorizedError('Invalid MFA code');
      }
    }
    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id);
    await this.repo.storeRefreshToken(user.id, refreshToken, new Date(Date.now() + 30 * 24 * 3600 * 1000));
    return { user: toPublicUser(user), accessToken, refreshToken };
  }

  async enrollMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    const secret = authenticator.generateSecret();
    await this.repo.setMfaSecret(userId, encryptField(secret));
    const otpauthUrl = authenticator.keyuri(user.email, 'Amrutam', secret);
    return { secret, otpauthUrl };
  }

  async confirmMfa(userId: string, code: string): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user || !user.mfaSecret) throw new ValidationError('MFA not enrolled');
    const secret = decryptField(user.mfaSecret);
    if (!authenticator.check(code, secret)) {
      throw new UnauthorizedError('Invalid MFA code');
    }
    await this.repo.enableMfa(userId);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const valid = await this.repo.isRefreshTokenValid(refreshToken);
    if (!valid) throw new UnauthorizedError('Invalid or expired refresh token');
    const payload = verifyRefreshToken(refreshToken);
    const user = await this.repo.findById(payload.sub);
    if (!user) throw new NotFoundError('User not found');
    await this.repo.revokeRefreshToken(refreshToken);
    const accessToken = signAccessToken(user.id, user.role);
    const newRefreshToken = signRefreshToken(user.id);
    await this.repo.storeRefreshToken(user.id, newRefreshToken, new Date(Date.now() + 30 * 24 * 3600 * 1000));
    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.repo.revokeRefreshToken(refreshToken);
  }
}
