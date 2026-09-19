import { Queue } from 'bullmq';
import { loadEnv } from '../config/env';

export type JobQueueName = 'pdf-generation' | 'notifications' | 'analytics-rollup' | 'search-sync';

const queues = new Map<JobQueueName, Queue>();

function connectionOptions() {
  const url = new URL(loadEnv().REDIS_URL);
  return { host: url.hostname, port: Number(url.port || 6379) };
}

export function getQueue(name: JobQueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: connectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
    queues.set(name, queue);
  }
  return queue;
}

export async function scheduleAnalyticsRollup(): Promise<void> {
  const queue = getQueue('analytics-rollup');
  // NOTE: bullmq@6 removed the `repeat` option from Queue.add() (JobsOptions no
  // longer includes it — see JobSchedulerJobOptions in bullmq's job-options.d.ts,
  // which is explicitly internal). The documented replacement for scheduling a
  // repeatable job is upsertJobScheduler, which is idempotent on the scheduler id
  // ('nightly-analytics-rollup') and produces the same cron-scheduled behavior the
  // brief's `queue.add(..., { repeat, jobId })` shape intended.
  await queue.upsertJobScheduler(
    'nightly-analytics-rollup',
    { pattern: '0 2 * * *' },
    { name: 'nightly-rollup', data: { date: new Date().toISOString() } },
  );
}
