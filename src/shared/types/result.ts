import type { z } from 'zod';
import type {
  regenerateFromReviewInputSchema,
  resultRecordSchema,
  resultReviewActionSchema,
  resultStatusSchema,
  reviewActionTypeSchema,
} from '../schema/result';
import type { AssetRecord } from './asset';

export type ResultStatus = z.infer<typeof resultStatusSchema>;
export type ReviewActionType = z.infer<typeof reviewActionTypeSchema>;
export type ResultRecord = z.infer<typeof resultRecordSchema>;
export type ResultReviewActionRecord = z.infer<typeof resultReviewActionSchema>;
export type RegenerateFromReviewInput = z.infer<typeof regenerateFromReviewInputSchema>;

export type ResultBridgeApi = {
  listTaskResults: (taskId: string) => Promise<ResultRecord[]>;
  listProjectResults: (projectId: string) => Promise<ResultRecord[]>;
  listTaskReviewActions: (taskId: string) => Promise<ResultReviewActionRecord[]>;
  approveResult: (taskId: string, resultId: string, note?: string) => Promise<ResultRecord>;
  regenerateResult: (
    taskId: string,
    resultId: string,
    input: RegenerateFromReviewInput,
  ) => Promise<ResultRecord[]>;
  saveResultAsTextAsset: (resultId: string) => Promise<AssetRecord>;
};
