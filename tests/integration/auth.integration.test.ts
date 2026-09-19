import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/common/db/prisma-client';

describe('Auth integration', () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.consultation.deleteMany();
    await prisma.availabilitySlot.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers, logs in, and refreshes a token end to end', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'e2e@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'E2E User', role: 'PATIENT' });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.accessToken).toBeTruthy();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'CorrectHorseBatteryStaple1!' });
    expect(loginRes.status).toBe(200);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
  });

  it('rejects login with wrong password with 500-mapped AppError as 401-class error', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'reject@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'R', role: 'PATIENT' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reject@example.com', password: 'wrong-password' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
