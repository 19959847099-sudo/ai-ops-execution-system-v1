import type { z } from 'zod';
import type {
  regenerateFromReviewInputSchema,
  resultAutoFeedbackRecordSchema,
  resultAutoFeedbackStatusSchema,
  resultAutoFeedbackTypeSchema,
  resultRecordSchema,
  resultReviewActionSchema,
  resultStatusSchema,
  reviewActionTypeSchema,
} from '../schema/result';
import type { AssetRecord } from './asset';

export type ResultStatus = z.infer<typeof resultStatusSchema>;
export type ReviewActionType = z.infer<typeof reviewActionTypeSchema>;
export type ResultAutoFeedbackType = z.infer<typeof resultAutoFeedbackTypeSchema>;
export type ResultAutoFeedbackStatus = z.infer<typeof resultAutoFeedbackStatusSchema>;
export type ResultRecord = z.infer<typeof resultRecordSchema>;
export type ResultReviewActionRecord = z.infer<typeof resultReviewActionSchema>;
export type ResultAutoFeedbackRecord = z.infer<typeof resultAutoFeedbackRecordSchema>;
export type RegenerateFromReviewInput = z.infer<typeof regenerateFromReviewInputSchema>;

export type ResultBridgeApi = {
  listTaskResults: (taskId: string) => Promise<ResultRecord[]>;
  listProjectResults: (projectId: string) => Promise<ResultRecord[]>;
  listTaskReviewActions: (taskId: string) => Promise<ResultReviewActionRecord[]>;
  listTaskAutoFeedbacks: (taskId: string) => Promise<ResultAutoFeedbackRecord[]>;
  listProjectAutoFeedbacks: (projectId: string) => Promise<ResultAutoFeedbackRecord[]>;
  approveResult: (taskId: string, resultId: string, note?: string) => Promise<ResultRecord>;
  regenerateResult: (
    taskId: string,
    resultId: string,
    input: RegenerateFromReviewInput,
  ) => Promise<ResultRecord[]>;
  saveResultAsTextAsset: (resultId: string) => Promise<AssetRecord>;
};
