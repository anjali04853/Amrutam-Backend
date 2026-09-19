import pino from 'pino';
import { loadEnv } from '../config/env';

export const logger = pino({
  level: loadEnv().LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
