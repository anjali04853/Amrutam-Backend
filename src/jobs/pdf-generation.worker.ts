import { Worker } from 'bullmq';
import { loadEnv } from '../config/env';
import { logger } from '../observability/logger';
import { prisma } from '../common/db/prisma-client';

function connectionOptions() {
  const url = new URL(loadEnv().REDIS_URL);
  return { host: url.hostname, port: Number(url.port || 6379) };
}

export function startPdfGenerationWorker(): Worker {
  return new Worker(
    'pdf-generation',
    async (job) => {
      const { prescriptionId } = job.data as { prescriptionId: string };
      logger.info({ prescriptionId }, 'generating prescription PDF');
      // Placeholder PDF URL — a real implementation renders via a PDF library
      // (e.g. pdfkit) and uploads to object storage.
      const pdfUrl = `https://storage.local/prescriptions/${prescriptionId}.pdf`;
      await prisma.prescription.update({ where: { id: prescriptionId }, data: { pdfUrl } });
    },
    { connection: connectionOptions() },
  );
}
