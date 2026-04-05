import { z } from 'zod';

export const taskStatusSchema = z.enum(['draft']);

export const createTaskShellInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

