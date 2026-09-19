import { z } from 'zod';

export const doctorProfileSchema = z.object({
  specialty: z.string().min(1),
  licenseNumber: z.string().min(1),
  bio: z.string().optional(),
  consultationFee: z.number().positive(),
  yearsExperience: z.number().int().nonnegative(),
});

export const slotInputSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

export const addAvailabilitySchema = z.object({
  slots: z.array(slotInputSchema).min(1).max(100),
});

export const listAvailabilityQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
