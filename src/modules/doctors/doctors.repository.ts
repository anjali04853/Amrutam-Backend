import type { PrismaClient, Doctor, AvailabilitySlot } from '@prisma/client';

export class DoctorsRepository {
  constructor(private readonly db: PrismaClient) {}

  async createProfile(
    userId: string,
    data: { specialty: string; licenseNumberEnc: string; bio?: string; consultationFee: number; yearsExperience: number },
  ): Promise<Doctor> {
    return this.db.doctor.create({ data: { userId, ...data } });
  }

  async findOverlapping(doctorId: string, startTime: Date, endTime: Date): Promise<AvailabilitySlot[]> {
    return this.db.availabilitySlot.findMany({
      where: {
        doctorId,
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
    });
  }

  async createSlots(
    doctorId: string,
    slots: { startTime: Date; endTime: Date }[],
  ): Promise<AvailabilitySlot[]> {
    await this.db.availabilitySlot.createMany({
      data: slots.map((s) => ({ doctorId, startTime: s.startTime, endTime: s.endTime })),
    });
    return this.db.availabilitySlot.findMany({
      where: { doctorId, startTime: { in: slots.map((s) => s.startTime) } },
    });
  }

  async findOpenSlots(doctorId: string, from: Date, to: Date): Promise<AvailabilitySlot[]> {
    return this.db.availabilitySlot.findMany({
      where: { doctorId, status: 'OPEN', startTime: { gte: from, lte: to } },
      orderBy: { startTime: 'asc' },
    });
  }
}
