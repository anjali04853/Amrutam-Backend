import { Worker } from 'bullmq';
import { loadEnv } from '../config/env';
import { logger } from '../observability/logger';
import { prisma } from '../common/db/prisma-client';
import { AdminRepository } from '../modules/admin/admin.repository';

function connectionOptions() {
  const url = new URL(loadEnv().REDIS_URL);
  return { host: url.hostname, port: Number(url.port || 6379) };
}

export async function computeDailySummary(date: Date): Promise<void> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [totalConsultations, cancelledCount, noShowCount, revenueAgg] = await Promise.all([
    prisma.consultation.count({ where: { scheduledAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.consultation.count({ where: { scheduledAt: { gte: dayStart, lt: dayEnd }, status: 'CANCELLED' } }),
    prisma.consultation.count({ where: { scheduledAt: { gte: dayStart, lt: dayEnd }, status: 'NO_SHOW' } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCEEDED', createdAt: { gte: dayStart, lt: dayEnd } },
    }),
  ]);

  const repo = new AdminRepository(prisma);
  await repo.upsertSummary(dayStart, {
    totalConsultations,
    totalRevenue: revenueAgg._sum.amount ?? 0,
    cancelledCount,
    noShowCount,
  } as never);
}

export function startAnalyticsRollupWorker(): Worker {
  return new Worker(
    'analytics-rollup',
    async (job) => {
      const { date } = job.data as { date: string };
      logger.info({ date }, 'computing daily analytics summary');
      await computeDailySummary(new Date(date));
    },
    { connection: connectionOptions() },
  );
}
