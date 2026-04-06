import { z } from 'zod';
import { taskCandidateSegmentSchema, taskFormSchema } from './task';

export const resultStatusSchema = z.enum(['pending_review', 'approved', 'rejected']);
export const reviewActionTypeSchema = z.enum(['approved', 'regenerated', 'saved_as_asset']);
export const resultAutoFeedbackTypeSchema = z.enum(['title', 'cover_text']);
export const resultAutoFeedbackStatusSchema = z.enum(['completed', 'failed']);

const baseResultSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  projectId: z.string(),
  sourceResultId: z.string().nullable(),
  resultType: taskFormSchema,
  title: z.string().trim().min(1).max(200),
  coverText: z.string().trim().max(120).default(''),
  status: resultStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const articleResultSchema = baseResultSchema.extend({
  resultType: z.literal('article'),
  body: z.string().trim().min(1),
});

export const videoResultSchema = baseResultSchema.extend({
  resultType: z.literal('video'),
  structuredDescription: z.string().trim().min(1),
  segments: z.array(taskCandidateSegmentSchema).min(1).max(12),
});

export const resultRecordSchema = z.discriminatedUnion('resultType', [
  articleResultSchema,
  videoResultSchema,
]);

export const resultReviewActionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  resultId: z.string(),
  actionType: reviewActionTypeSchema,
  note: z.string(),
  relatedAssetId: z.string().nullable(),
  createdAt: z.string(),
});

export const resultAutoFeedbackRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  resultId: z.string(),
  feedbackType: resultAutoFeedbackTypeSchema,
  feedbackText: z.string(),
  assetId: z.string().nullable(),
  status: resultAutoFeedbackStatusSchema,
  errorMessage: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const regenerateFromReviewInputSchema = z.object({
  note: z.string().trim().max(240).default(''),
});
