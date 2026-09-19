import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/common/db/prisma-client';

describe('Audit log integration', () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
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

  it('records an audit log entry for a booking and an admin can read it', async () => {
    const docRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'audit-doc@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Dr. Audit', role: 'DOCTOR' });
    await request(app)
      .post('/api/v1/doctors/me/profile')
      .set('Authorization', `Bearer ${docRes.body.accessToken}`)
      .send({ specialty: 'General', licenseNumber: 'LIC-AUDIT', consultationFee: 200, yearsExperience: 4 });
    const slotRes = await request(app)
      .post('/api/v1/doctors/me/availability')
      .set('Authorization', `Bearer ${docRes.body.accessToken}`)
      .send({ slots: [{ startTime: '2026-12-01T09:00:00.000Z', endTime: '2026-12-01T09:30:00.000Z' }] });

    const patientRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'audit-patient@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Pat', role: 'PATIENT' });
    await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${patientRes.body.accessToken}`)
      .set('Idempotency-Key', 'audit-key-1')
      .send({ doctorId: docRes.body.user.id, slotId: slotRes.body[0].id });

    const adminRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'audit-admin@example.com', password: 'CorrectHorseBatteryStaple1!', name: 'Admin', role: 'PATIENT' });
    await prisma.user.update({ where: { id: adminRes.body.user.id }, data: { role: 'ADMIN' } });
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'audit-admin@example.com', password: 'CorrectHorseBatteryStaple1!' });

    const logsRes = await request(app)
      .get('/api/v1/admin/audit-logs?resourceType=Consultation')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);

    expect(logsRes.status).toBe(200);
    expect(logsRes.body.length).toBeGreaterThanOrEqual(1);
    expect(logsRes.body[0].action).toBe('CONSULTATION_BOOKED');
  });
});
