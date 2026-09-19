import { Worker } from 'bullmq';
import { loadEnv } from '../config/env';
import { logger } from '../observability/logger';

function connectionOptions() {
  const url = new URL(loadEnv().REDIS_URL);
  return { host: url.hostname, port: Number(url.port || 6379) };
}

export function startNotificationsWorker(): Worker {
  return new Worker(
    'notifications',
    async (job) => {
      logger.info({ jobName: job.name, data: job.data }, 'sending notification (stub)');
      // Placeholder — a real implementation sends email/SMS/push via a
      // provider adapter. Logged here so the flow is observable end to end.
    },
    { connection: connectionOptions() },
  );
}
