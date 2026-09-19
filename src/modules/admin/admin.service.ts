import type { AdminRepository } from './admin.repository';

export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  async getDailyAnalytics(from: Date, to: Date) {
    return this.repo.findSummaries(from, to);
  }
}
