import dotenv from 'dotenv';
dotenv.config();

import { initOtel } from './observability/otel';
initOtel('amrutam-worker');

import { startPdfGenerationWorker } from './jobs/pdf-generation.worker';
import { startNotificationsWorker } from './jobs/notifications.worker';
import { startAnalyticsRollupWorker } from './jobs/analytics-rollup.worker';
import { scheduleAnalyticsRollup } from './jobs/queue';
import { logger } from './observability/logger';

async function main() {
  startPdfGenerationWorker();
  startNotificationsWorker();
  startAnalyticsRollupWorker();
  await scheduleAnalyticsRollup();
  logger.info('worker process started: pdf-generation, notifications, analytics-rollup');
}

main().catch((err) => {
  logger.error({ err }, 'worker process failed to start');
  process.exit(1);
});
