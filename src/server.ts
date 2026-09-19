import dotenv from 'dotenv';
dotenv.config();

import { initOtel } from './observability/otel';
initOtel('amrutam-backend');

import { createApp } from './app';
import { loadEnv } from './config/env';
import { logger } from './observability/logger';

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'server listening');
});
