import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/common/db/prisma-client';

describe('Booking concurrency', () => {
  const app = createApp();

  beforeEach(async () => {
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
  });

  async function setupDoctorWithSlot() {
    const docRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'concurrency-doc@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Dr. Race', role: 'DOCTOR' });
    const docToken = docRes.body.accessToken as string;
    const docId = docRes.body.user.id as string;

    await request(app)
      .post('/api/v1/doctors/me/profile')
      .set('Authorization', `Bearer ${docToken}`)
      .send({ specialty: 'General', licenseNumber: 'LIC-RACE', consultationFee: 100, yearsExperience: 2 });

    const slotRes = await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${docToken}`)
      .send({ slots: [{ startTime: '2026-11-01T10:00:00.000Z', endTime: '2026-11-01T10:30:00.000Z' }] });

    return { doctorId: docId, slotId: slotRes.body[0].id as string };
  }

  async function registerPatient(email: string) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'CorrectHorseBatteryStaple1!', name: 'Patient', role: 'PATIENT' });
    return res.body.accessToken as string;
  }

  it('exactly one of two concurrent booking requests for the same slot succeeds', async () => {
    const { doctorId, slotId } = await setupDoctorWithSlot();
    const [tokenA, tokenB] = await Promise.all([
      registerPatient('racer-a@example.com'),
      registerPatient('racer-b@example.com'),
    ]);

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', 'race-key-a')
        .send({ doctorId, slotId }),
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('Idempotency-Key', 'race-key-b')
        .send({ doctorId, slotId }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const consultations = await prisma.consultation.findMany({ where: { slotId } });
    expect(consultations).toHaveLength(1);
  });

  it('replaying the same Idempotency-Key returns the original booking, not a duplicate', async () => {
    const { doctorId, slotId } = await setupDoctorWithSlot();
    const token = await registerPatient('idem-replay@example.com');

    const first = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'replay-key-1')
      .send({ doctorId, slotId });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'replay-key-1')
      .send({ doctorId, slotId });
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const consultations = await prisma.consultation.findMany({ where: { slotId } });
    expect(consultations).toHaveLength(1);
  });
});
