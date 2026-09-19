import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { authRouter } from './modules/auth/auth.routes';
import { doctorsRouter } from './modules/doctors/doctors.routes';
import { bookingRouter } from './modules/booking/booking.routes';
import { consultationsRouter } from './modules/consultations/consultations.routes';
import { prescriptionsRouter } from './modules/prescriptions/prescriptions.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { searchRouter } from './modules/search/search.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { docsRouter } from './common/docs.routes';
import { errorHandler } from './common/middleware/error-handler';
import { logger } from './observability/logger';
import { metricsMiddleware, getMetricsRegistry } from './observability/metrics';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(metricsMiddleware);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', getMetricsRegistry().contentType);
    res.send(await getMetricsRegistry().metrics());
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/doctors', doctorsRouter);
  app.use('/api/v1/bookings', bookingRouter);
  app.use('/api/v1/consultations', consultationsRouter);
  app.use('/api/v1/prescriptions', prescriptionsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/admin', auditRouter);

  app.use('/docs', docsRouter);

  app.use(errorHandler);

  return app;
}
