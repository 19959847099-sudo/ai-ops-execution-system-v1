import type Database from 'better-sqlite3';
import { taskPreparationMemorySnapshotSchema } from '../../shared/schema/memory';
import type { TaskPreparationMemorySnapshot } from '../../shared/types/memory';
import { ProjectService } from './project.service';
import { SettingsService } from './settings.service';

type TaskSnapshotRow = {
  id: string;
  project_id: string;
  title: string;
};

export class MemoryService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly settingsService: SettingsService,
  ) {}

  getTaskPreparationMemorySnapshot(taskId: string): TaskPreparationMemorySnapshot {
    const task = this.db
      .prepare(
        `
          SELECT id, project_id, title
          FROM tasks
          WHERE id = ?
        `,
      )
      .get(taskId) as TaskSnapshotRow | undefined;

    if (!task) {
      throw new Error('任务不存在。');
    }

    return taskPreparationMemorySnapshotSchema.parse({
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.project_id,
      projectResidentMemory: this.projectService.getProjectResidentMemory(task.project_id),
      userResidentMemory: this.settingsService.getUserResidentMemory(),
    });
  }
}
