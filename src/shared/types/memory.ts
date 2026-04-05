import type { z } from 'zod';
import type {
  projectResidentMemorySchema,
  taskPreparationMemorySnapshotSchema,
  userResidentMemorySchema,
} from '../schema/memory';

export type ProjectResidentMemory = z.infer<typeof projectResidentMemorySchema>;
export type UpdateProjectResidentMemoryInput = ProjectResidentMemory;

export type UserResidentMemory = z.infer<typeof userResidentMemorySchema>;
export type UpdateUserResidentMemoryInput = UserResidentMemory;

export type TaskPreparationMemorySnapshot = z.infer<typeof taskPreparationMemorySnapshotSchema>;

export type MemoryBridgeApi = {
  getProjectResidentMemory: (projectId: string) => Promise<ProjectResidentMemory>;
  updateProjectResidentMemory: (
    projectId: string,
    input: UpdateProjectResidentMemoryInput,
  ) => Promise<ProjectResidentMemory>;
  getUserResidentMemory: () => Promise<UserResidentMemory>;
  updateUserResidentMemory: (input: UpdateUserResidentMemoryInput) => Promise<UserResidentMemory>;
  getTaskPreparationMemorySnapshot: (taskId: string) => Promise<TaskPreparationMemorySnapshot>;
};

