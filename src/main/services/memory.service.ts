import { taskPreparationMemorySnapshotSchema } from '../../shared/schema/memory';
import type { TaskPreparationMemorySnapshot } from '../../shared/types/memory';
import { ProjectService } from './project.service';
import { SettingsService } from './settings.service';
import { TaskService } from './task.service';

export class MemoryService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly settingsService: SettingsService,
    private readonly taskService: TaskService,
  ) {}

  getTaskPreparationMemorySnapshot(taskId: string): TaskPreparationMemorySnapshot {
    const task = this.taskService.requireTask(taskId);

    return taskPreparationMemorySnapshotSchema.parse({
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId,
      projectResidentMemory: this.projectService.getProjectResidentMemory(task.projectId),
      userResidentMemory: this.settingsService.getUserResidentMemory(),
    });
  }
}
