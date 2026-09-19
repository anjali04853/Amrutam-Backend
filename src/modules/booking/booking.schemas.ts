import { z } from 'zod';

export const createBookingSchema = z.object({
  doctorId: z.string().uuid(),
  slotId: z.string().uuid(),
});
