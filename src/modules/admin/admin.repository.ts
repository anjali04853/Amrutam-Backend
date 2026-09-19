import type { PrismaClient, AnalyticsDailySummary } from '@prisma/client';

export class AdminRepository {
  constructor(private readonly db: PrismaClient) {}

  async findSummaries(from: Date, to: Date): Promise<AnalyticsDailySummary[]> {
    return this.db.analyticsDailySummary.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
  }

  async upsertSummary(date: Date, data: Omit<AnalyticsDailySummary, 'date' | 'computedAt'>): Promise<void> {
    await this.db.analyticsDailySummary.upsert({
      where: { date },
      create: { date, ...data },
      update: { ...data, computedAt: new Date() },
    });
  }
}
