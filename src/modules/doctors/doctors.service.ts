import type { DoctorsRepository } from './doctors.repository';
import { ConflictError, ValidationError } from '../../common/errors';
import { encryptField } from '../../common/crypto/field-encryption';

export interface DoctorProfileInput {
  specialty: string;
  licenseNumber: string;
  bio?: string;
  consultationFee: number;
  yearsExperience: number;
}

export interface SlotInput {
  startTime: string;
  endTime: string;
}

export class DoctorsService {
  constructor(private readonly repo: DoctorsRepository) {}

  async createProfile(userId: string, input: DoctorProfileInput) {
    return this.repo.createProfile(userId, {
      specialty: input.specialty,
      licenseNumberEnc: encryptField(input.licenseNumber),
      bio: input.bio,
      consultationFee: input.consultationFee,
      yearsExperience: input.yearsExperience,
    });
  }

  async addAvailability(doctorId: string, slots: SlotInput[]) {
    const parsed = slots.map((s) => ({ startTime: new Date(s.startTime), endTime: new Date(s.endTime) }));
    for (const s of parsed) {
      if (s.endTime <= s.startTime) {
        throw new ValidationError('Invalid slot: endTime must be after startTime');
      }
      const overlapping = await this.repo.findOverlapping(doctorId, s.startTime, s.endTime);
      if (overlapping.length > 0) {
        throw new ConflictError('New slot overlaps an existing availability slot');
      }
    }
    return this.repo.createSlots(doctorId, parsed);
  }

  async listAvailability(doctorId: string, from: Date, to: Date) {
    return this.repo.findOpenSlots(doctorId, from, to);
  }
}
