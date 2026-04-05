import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createTaskShellInputSchema } from '../../shared/schema/task';
import type {
  CreateTaskShellInput,
  TaskRecord,
  TaskStatus,
} from '../../shared/types/task';
import { ProjectService } from './project.service';

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export class TaskService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
  ) {}

  listTasks(projectId: string): TaskRecord[] {
    this.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        `
          SELECT id, project_id, title, status, created_at, updated_at
          FROM tasks
          WHERE project_id = ?
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all(projectId) as TaskRow[];

    return rows.map((row) => this.mapRow(row));
  }

  createTask(projectId: string, input: CreateTaskShellInput): TaskRecord {
    this.ensureProjectExists(projectId);
    const normalized = createTaskShellInputSchema.parse(input);
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          INSERT INTO tasks (id, project_id, title, status, created_at, updated_at)
          VALUES (?, ?, ?, 'draft', ?, ?)
        `,
      )
      .run(id, projectId, normalized.title, now, now);

    const task = this.getTaskById(id);
    if (!task) {
      throw new Error('任务承接壳创建后读取失败。');
    }

    return task;
  }

  getTaskById(taskId: string): TaskRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT id, project_id, title, status, created_at, updated_at
          FROM tasks
          WHERE id = ?
        `,
      )
      .get(taskId) as TaskRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  requireTask(taskId: string): TaskRecord {
    const task = this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在。');
    }

    return task;
  }

  private ensureProjectExists(projectId: string): void {
    if (!this.projectService.getProjectById(projectId)) {
      throw new Error('项目不存在。');
    }
  }

  private mapRow(row: TaskRow): TaskRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

