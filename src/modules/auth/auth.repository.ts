import { PrismaClient, User } from '@prisma/client';
import { createHash } from 'crypto';

export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  async createUser(data: {
    email: string;
    passwordHash: string;
    role: 'PATIENT' | 'DOCTOR';
    name: string;
  }): Promise<User> {
    return this.db.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        profile: { create: { name: data.name } },
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async storeRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.db.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  async setMfaSecret(userId: string, encryptedSecret: string): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { mfaSecret: encryptedSecret } });
  }

  async enableMfa(userId: string): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  }

  async isRefreshTokenValid(token: string): Promise<boolean> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.db.refreshToken.findUnique({ where: { tokenHash } });
    return !!record && !record.revoked && record.expiresAt > new Date();
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.db.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
  }
}
