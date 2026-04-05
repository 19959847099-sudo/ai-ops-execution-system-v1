import { z } from 'zod';

export const assetTypeSchema = z.enum(['image', 'video', 'text']);
export const assetStatusSchema = z.enum(['ready']);
export const assetFilterTypeSchema = z.enum(['all', 'image', 'video', 'text']);

export const createTextAssetInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  textContent: z.string().trim().min(1),
});

export const assetListQuerySchema = z.object({
  keyword: z.string().trim().default(''),
  type: assetFilterTypeSchema.default('all'),
});

