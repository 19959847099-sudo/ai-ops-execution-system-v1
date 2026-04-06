import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createTaskInputSchema } from '../../shared/schema/task';
import type {
  CreateTaskInput,
  TaskCandidateRecord,
  TaskForm,
  TaskRecord,
  TaskStatus,
} from '../../shared/types/task';
import type { RegenerateFromReviewInput, ResultRecord } from '../../shared/types/result';
import { AssetService } from './asset.service';
import { AiService } from './ai.service';
import { MemoryService } from './memory.service';
import { ProjectService } from './project.service';
import { ResultService } from './result.service';

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  goal: string;
  task_form: TaskForm;
  supplemental_requirements: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export class TaskService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly memoryService: MemoryService,
    private readonly assetService: AssetService,
    private readonly aiService: AiService,
    private readonly resultService: ResultService,
  ) {}

  listTasks(projectId: string): TaskRecord[] {
    this.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            project_id,
            title,
            goal,
            task_form,
            supplemental_requirements,
            status,
            created_at,
            updated_at
          FROM tasks
          WHERE project_id = ?
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all(projectId) as TaskRow[];

    return rows.map((row) => this.mapRow(row));
  }

  createTask(projectId: string, input: CreateTaskInput): TaskRecord {
    this.ensureProjectExists(projectId);
    const normalized = createTaskInputSchema.parse(input);
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
          INSERT INTO tasks (
            id,
            project_id,
            title,
            goal,
            task_form,
            supplemental_requirements,
            status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
        `,
      )
      .run(
        id,
        projectId,
        normalized.title,
        normalized.goal,
        normalized.taskForm,
        normalized.supplementalRequirements,
        now,
        now,
      );

    const task = this.getTaskById(id);
    if (!task) {
      throw new Error('任务创建后读取失败。');
    }

    return task;
  }

  getTaskById(taskId: string): TaskRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            project_id,
            title,
            goal,
            task_form,
            supplemental_requirements,
            status,
            created_at,
            updated_at
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

  listTaskCandidates(taskId: string): TaskCandidateRecord[] {
    return this.resultService.toTaskCandidates(this.resultService.listTaskResults(taskId));
  }

  async generateTaskCandidates(taskId: string): Promise<TaskCandidateRecord[]> {
    const results = await this.generateTaskResults(taskId);
    return this.resultService.toTaskCandidates(results);
  }

  async generateTaskResults(taskId: string): Promise<ResultRecord[]> {
    const task = this.requireTask(taskId);

    if (task.status === 'generating') {
      throw new Error('当前任务正在生成候选，请稍后再看结果。');
    }

    const existingPending = this.resultService
      .listTaskResults(taskId)
      .filter((result) => result.status === 'pending_review');

    if (existingPending.length > 0) {
      return existingPending;
    }

    return this.runGeneration(task, null, '');
  }

  async regenerateTaskResults(
    taskId: string,
    sourceResultId: string,
    input: RegenerateFromReviewInput,
  ): Promise<ResultRecord[]> {
    const task = this.requireTask(taskId);
    const sourceResult = this.resultService.requireResult(sourceResultId);

    if (sourceResult.taskId !== taskId) {
      throw new Error('结果与任务不匹配。');
    }

    if (sourceResult.status === 'approved') {
      throw new Error('已通过结果不能再作为打回重生成的来源。');
    }

    this.resultService.markResultRegenerated(taskId, sourceResultId, input);
    return this.runGeneration(task, sourceResultId, input.note.trim());
  }

  private async runGeneration(
    task: TaskRecord,
    sourceResultId: string | null,
    reviewInstruction: string,
  ): Promise<ResultRecord[]> {
    this.updateTaskStatus(task.id, 'generating');

    try {
      const memorySnapshot = this.memoryService.getTaskPreparationMemorySnapshot(task.id);
      const assets = this.assetService.listAssetsForTask(task.id);
      const generatedCandidates = await this.aiService.generateTaskCandidates({
        taskId: task.id,
        title: task.title,
        goal: task.goal,
        taskForm: task.taskForm,
        supplementalRequirements: task.supplementalRequirements,
        memorySnapshot,
        assets,
        reviewInstruction,
      });

      const results = this.resultService.replaceGeneratedResults(
        task,
        generatedCandidates.map((candidate, index) => ({
          id: `${task.id}-${Date.now()}-${index}`,
          taskId: task.id,
          sequence: index + 1,
          generatedAt: new Date().toISOString(),
          ...candidate,
        })) as TaskCandidateRecord[],
        sourceResultId,
      );
      this.updateTaskStatus(task.id, 'ready');
      return results;
    } catch (error) {
      this.updateTaskStatus(task.id, 'failed');
      throw error;
    }
  }

  private updateTaskStatus(taskId: string, status: TaskStatus): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          UPDATE tasks
          SET status = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(status, now, taskId);
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
      goal: row.goal,
      taskForm: row.task_form,
      supplementalRequirements: row.supplemental_requirements,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
