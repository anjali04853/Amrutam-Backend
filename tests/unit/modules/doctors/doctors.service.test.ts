import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DoctorsService } from '../../../../src/modules/doctors/doctors.service';
import type { DoctorsRepository } from '../../../../src/modules/doctors/doctors.repository';

function makeRepoMock() {
  return {
    createProfile: vi.fn(async (userId: string, data: any) => ({ userId, ...data })),
    findOverlapping: vi.fn(async () => []),
    createSlots: vi.fn(async (_doctorId: string, slots: any[]) => slots.map((s, i) => ({ id: `slot-${i}`, ...s }))),
    findOpenSlots: vi.fn(async () => []),
  } as unknown as DoctorsRepository;
}

describe('DoctorsService', () => {
  let repo: ReturnType<typeof makeRepoMock>;
  let service: DoctorsService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    repo = makeRepoMock();
    service = new DoctorsService(repo);
  });

  it('creates a doctor profile', async () => {
    const result = await service.createProfile('doc-1', {
      specialty: 'Cardiology',
      licenseNumber: 'LIC-123',
      consultationFee: 500,
      yearsExperience: 5,
    });
    expect(result.userId).toBe('doc-1');
    expect(repo.createProfile).toHaveBeenCalledOnce();
  });

  it('adds non-overlapping availability slots', async () => {
    const slots = await service.addAvailability('doc-1', [
      { startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T09:30:00Z' },
    ]);
    expect(slots).toHaveLength(1);
    expect(repo.createSlots).toHaveBeenCalledOnce();
  });

  it('rejects overlapping availability slots', async () => {
    repo.findOverlapping = vi.fn(async () => [{ id: 'existing-slot' }]) as never;
    await expect(
      service.addAvailability('doc-1', [{ startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T09:30:00Z' }]),
    ).rejects.toThrow(/overlap/i);
  });

  it('rejects a slot where endTime is before startTime', async () => {
    await expect(
      service.addAvailability('doc-1', [{ startTime: '2026-10-01T09:30:00Z', endTime: '2026-10-01T09:00:00Z' }]),
    ).rejects.toThrow(/end.*before|invalid/i);
  });
});
