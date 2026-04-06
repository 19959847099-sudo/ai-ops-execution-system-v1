import type { z } from 'zod';
import type {
  articleTaskCandidateSchema,
  createTaskInputSchema,
  createTaskShellInputSchema,
  taskCandidateSchema,
  taskCandidateSegmentSchema,
  taskFormSchema,
  taskStatusSchema,
  videoTaskCandidateSchema,
} from '../schema/task';
import type { AssetRecord } from './asset';

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskForm = z.infer<typeof taskFormSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type CreateTaskShellInput = z.infer<typeof createTaskShellInputSchema>;
export type TaskCandidateSegment = z.infer<typeof taskCandidateSegmentSchema>;
export type TaskCandidateRecord = z.infer<typeof taskCandidateSchema>;
export type ArticleTaskCandidateRecord = z.infer<typeof articleTaskCandidateSchema>;
export type VideoTaskCandidateRecord = z.infer<typeof videoTaskCandidateSchema>;

export type TaskRecord = {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  taskForm: TaskForm;
  supplementalRequirements: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type TaskAssetRecord = {
  id: string;
  taskId: string;
  assetId: string;
  addedAt: string;
  sortOrder: number;
  asset: AssetRecord;
};

export type TaskBridgeApi = {
  listTasks: (projectId: string) => Promise<TaskRecord[]>;
  createTask: (projectId: string, input: CreateTaskInput) => Promise<TaskRecord>;
  getTaskById: (taskId: string) => Promise<TaskRecord | null>;
  listTaskAssets: (taskId: string) => Promise<TaskAssetRecord[]>;
  attachAsset: (taskId: string, assetId: string) => Promise<TaskAssetRecord>;
  removeAsset: (taskId: string, assetId: string) => Promise<void>;
  listTaskCandidates: (taskId: string) => Promise<TaskCandidateRecord[]>;
  generateTaskCandidates: (taskId: string) => Promise<TaskCandidateRecord[]>;
};
