import client from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

client.collectDefaultMetrics();

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const end = httpRequestDurationSeconds.startTimer();
  res.on('finish', () => {
    // By the time `finish` fires the response has completed, so routing has already
    // happened and req.route is populated for matched routes even though this
    // middleware itself runs before the routers are mounted. req.route.path is the
    // parameterized pattern (e.g. "/:id/status"), which keeps cardinality bounded.
    // For unmatched requests (404s) req.route is undefined -- use a single constant
    // label rather than any form of the raw path, since an attacker can otherwise
    // spray arbitrary unmatched paths (UUID or not) to inflate label cardinality.
    end({
      method: req.method,
      route: req.route?.path ?? '<unmatched>',
      status_code: res.statusCode,
    });
  });
  next();
}

export function getMetricsRegistry(): typeof client.register {
  return client.register;
}
