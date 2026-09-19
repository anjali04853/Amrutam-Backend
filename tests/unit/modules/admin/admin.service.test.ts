import { describe, it, expect, vi } from 'vitest';
import { AdminService } from '../../../../src/modules/admin/admin.service';
import type { AdminRepository } from '../../../../src/modules/admin/admin.repository';

describe('AdminService.getDailyAnalytics', () => {
  it('returns pre-aggregated rows from the repository for the given range', async () => {
    const repo = {
      findSummaries: vi.fn(async () => [
        { date: new Date('2026-09-01'), totalConsultations: 120, totalRevenue: 45000, cancelledCount: 3, noShowCount: 2 },
      ]),
    } as unknown as AdminRepository;
    const service = new AdminService(repo);

    const result = await service.getDailyAnalytics(new Date('2026-09-01'), new Date('2026-09-02'));

    expect(result).toHaveLength(1);
    expect(repo.findSummaries).toHaveBeenCalledWith(new Date('2026-09-01'), new Date('2026-09-02'));
  });
});
