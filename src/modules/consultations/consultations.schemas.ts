import { z } from 'zod';

export const transitionSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
});
