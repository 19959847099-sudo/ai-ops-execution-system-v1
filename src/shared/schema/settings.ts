import { z } from 'zod';

export const systemSettingsSchema = z.object({
  providerName: z.literal('qwen'),
  apiBaseUrl: z.string(),
  apiKey: z.string(),
  modelName: z.string(),
  appRootPath: z.string(),
  projectRootPath: z.string(),
});

export const residentUserPreferencesSchema = z.object({
  language: z.string().default('zh-CN'),
  navigationCollapsed: z.boolean().default(false),
  productPreference: z.string().default(''),
  expressionPreference: z.string().default(''),
  designPreference: z.string().default(''),
  developmentPreference: z.string().default(''),
  costPreference: z.string().default(''),
});
