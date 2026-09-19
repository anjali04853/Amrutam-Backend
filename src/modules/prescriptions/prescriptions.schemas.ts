import { z } from 'zod';

export const issuePrescriptionSchema = z.object({
  medicines: z.array(z.object({ name: z.string().min(1), dosage: z.string().min(1) })).min(1),
  notes: z.string().optional(),
});
