import { z } from 'zod';

export const projectResidentMemorySchema = z.object({
  oneLineDefinition: z.string().default(''),
  targetAudience: z.string().default(''),
  coreValue: z.string().default(''),
  currentFocus: z.string().default(''),
  forbiddenExpressions: z.string().default(''),
  fixedConstraints: z.string().default(''),
});

export const userResidentMemorySchema = z.object({
  productPreference: z.string().default(''),
  expressionPreference: z.string().default(''),
  designPreference: z.string().default(''),
  developmentPreference: z.string().default(''),
  costPreference: z.string().default(''),
});

export const recentTemporaryMemoryRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  resultId: z.string(),
  summaryText: z.string().trim().min(1).max(120),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export const taskPreparationMemorySnapshotSchema = z.object({
  taskId: z.string(),
  taskTitle: z.string(),
  projectId: z.string(),
  projectResidentMemory: projectResidentMemorySchema,
  userResidentMemory: userResidentMemorySchema,
  recentTemporaryMemories: z.array(recentTemporaryMemoryRecordSchema).default([]),
});
