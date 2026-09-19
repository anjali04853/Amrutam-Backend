import { PrismaClient } from '@prisma/client';
import { logger } from '../../observability/logger';

export const prisma = new PrismaClient();

process.on('beforeExit', () => {
  logger.info('Prisma client disconnecting');
});
