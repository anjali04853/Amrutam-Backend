import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/common/db/prisma-client';

describe('Doctors integration', () => {
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

  async function registerDoctor() {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'doc@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Dr. Doc', role: 'DOCTOR' });
    return res.body.accessToken as string;
  }

  it('creates a doctor profile and adds availability slots', async () => {
    const token = await registerDoctor();

    const profileRes = await request(app)
      .post('/api/v1/doctors/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialty: 'Dermatology', licenseNumber: 'LIC-999', consultationFee: 300, yearsExperience: 3 });
    expect(profileRes.status).toBe(201);

    const slotRes = await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ slots: [{ startTime: '2026-10-05T09:00:00.000Z', endTime: '2026-10-05T09:30:00.000Z' }] });
    expect(slotRes.status).toBe(201);
    expect(slotRes.body).toHaveLength(1);
  });

  it('rejects a patient trying to create a doctor profile', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'patient@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Pat', role: 'PATIENT' });

    const res = await request(app)
      .post('/api/v1/doctors/me/profile')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .send({ specialty: 'X', licenseNumber: 'L', consultationFee: 100, yearsExperience: 1 });
    expect(res.status).toBe(403);
  });
});
