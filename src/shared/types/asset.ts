import type { z } from 'zod';
import type {
  assetFilterTypeSchema,
  assetStatusSchema,
  assetTypeSchema,
  assetListQuerySchema,
  createTextAssetInputSchema,
} from '../schema/asset';

export type AssetType = z.infer<typeof assetTypeSchema>;
export type AssetStatus = z.infer<typeof assetStatusSchema>;
export type AssetFilterType = z.infer<typeof assetFilterTypeSchema>;
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;
export type CreateTextAssetInput = z.infer<typeof createTextAssetInputSchema>;

export type AssetRecord = {
  id: string;
  projectId: string;
  fileName: string;
  displayName: string;
  assetType: AssetType;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  relativePath: string;
  absolutePath: string;
  fileUrl: string;
  textContent: string | null;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

export type AssetLibrarySummary = {
  totalCount: number;
  imageCount: number;
  videoCount: number;
  textCount: number;
  lastImportedAt: string | null;
};

export type AssetBridgeApi = {
  importAssets: (projectId: string) => Promise<AssetRecord[]>;
  createTextAsset: (projectId: string, input: CreateTextAssetInput) => Promise<AssetRecord>;
  listAssets: (projectId: string, query?: Partial<AssetListQuery>) => Promise<AssetRecord[]>;
  getAssetById: (assetId: string) => Promise<AssetRecord | null>;
  getAssetLibrarySummary: (projectId: string) => Promise<AssetLibrarySummary>;
};

