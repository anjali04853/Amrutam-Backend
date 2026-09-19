import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/common/db/prisma-client';
import { getRedisClient } from '../../src/common/redis-client';

describe('Search integration', () => {
  const app = createApp();

  beforeEach(async () => {
    await getRedisClient().flushdb();
    await prisma.payment.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.consultation.deleteMany();
    await prisma.availabilitySlot.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await getRedisClient().quit();
  });

  it('finds a doctor by specialty filter', async () => {
    const docRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'search-doc@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Dr. Search', role: 'DOCTOR' });
    await request(app)
      .post('/api/v1/doctors/me/profile')
      .set('Authorization', `Bearer ${docRes.body.accessToken}`)
      .send({ specialty: 'Neurology', licenseNumber: 'LIC-SEARCH', consultationFee: 700, yearsExperience: 8 });

    const patientRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'search-patient@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Pat', role: 'PATIENT' });

    const res = await request(app)
      .get('/api/v1/search/doctors?specialty=Neurology')
      .set('Authorization', `Bearer ${patientRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].specialty).toBe('Neurology');
  });
});
