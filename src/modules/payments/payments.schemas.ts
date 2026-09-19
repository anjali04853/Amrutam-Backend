import { z } from 'zod';

export const createPaymentSchema = z.object({
  consultationId: z.string().uuid(),
  forceOutcome: z.enum(['success', 'fail', 'timeout']).optional(),
});
