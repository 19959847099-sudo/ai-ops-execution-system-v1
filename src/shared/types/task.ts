import type { z } from 'zod';
import type { createTaskShellInputSchema, taskStatusSchema } from '../schema/task';
import type { AssetRecord } from './asset';

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskShellInput = z.infer<typeof createTaskShellInputSchema>;

export type TaskRecord = {
  id: string;
  projectId: string;
  title: string;
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
  createTask: (projectId: string, input: CreateTaskShellInput) => Promise<TaskRecord>;
  getTaskById: (taskId: string) => Promise<TaskRecord | null>;
  listTaskAssets: (taskId: string) => Promise<TaskAssetRecord[]>;
  attachAsset: (taskId: string, assetId: string) => Promise<TaskAssetRecord>;
  removeAsset: (taskId: string, assetId: string) => Promise<void>;
};

