import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  specialty: z.string().optional(),
  maxFee: z.coerce.number().positive().optional(),
  availableFrom: z.string().datetime().optional(),
});
