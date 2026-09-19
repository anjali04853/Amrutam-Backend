import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  name: z.string().min(1),
  role: z.enum(['PATIENT', 'DOCTOR']),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
});

export const mfaConfirmSchema = z.object({
  code: z.string().length(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
