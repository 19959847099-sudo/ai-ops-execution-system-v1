import { z } from 'zod';

export const taskStatusSchema = z.enum(['draft', 'generating', 'ready', 'failed']);
export const taskFormSchema = z.enum(['article', 'video']);

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(240),
  taskForm: taskFormSchema,
  supplementalRequirements: z.string().trim().max(1000).default(''),
});

export const createTaskShellInputSchema = createTaskInputSchema;

export const taskCandidateSegmentSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(1000),
});

const baseTaskCandidateSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  sequence: z.number().int().min(1),
  title: z.string().trim().min(1).max(200),
  generatedAt: z.string(),
});

export const articleTaskCandidateSchema = baseTaskCandidateSchema.extend({
  candidateType: z.literal('article'),
  body: z.string().trim().min(1),
});

export const videoTaskCandidateSchema = baseTaskCandidateSchema.extend({
  candidateType: z.literal('video'),
  structuredDescription: z.string().trim().min(1),
  segments: z.array(taskCandidateSegmentSchema).min(1).max(12),
});

export const taskCandidateSchema = z.discriminatedUnion('candidateType', [
  articleTaskCandidateSchema,
  videoTaskCandidateSchema,
]);
