import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  articleTaskCandidateSchema,
  createTaskInputSchema,
  taskCandidateSchema,
  videoTaskCandidateSchema,
} from '../../shared/schema/task';
import type {
  ArticleTaskCandidateRecord,
  CreateTaskInput,
  TaskCandidateRecord,
  TaskForm,
  TaskRecord,
  TaskStatus,
  VideoTaskCandidateRecord,
} from '../../shared/types/task';
import { AssetService } from './asset.service';
import { AiService } from './ai.service';
import { MemoryService } from './memory.service';
import { ProjectService } from './project.service';

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

type TaskCandidateRow = {
  id: string;
  task_id: string;
  candidate_type: 'article' | 'video';
  sequence: number;
  title: string;
  body: string | null;
  structured_description: string | null;
  segments_json: string | null;
  generated_at: string;
};

export class TaskService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly memoryService: MemoryService,
    private readonly assetService: AssetService,
    private readonly aiService: AiService,
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
    this.requireTask(taskId);
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            task_id,
            candidate_type,
            sequence,
            title,
            body,
            structured_description,
            segments_json,
            generated_at
          FROM task_candidates
          WHERE task_id = ?
          ORDER BY sequence ASC, generated_at ASC
        `,
      )
      .all(taskId) as TaskCandidateRow[];

    return rows.map((row) => this.mapCandidateRow(row));
  }

  async generateTaskCandidates(taskId: string): Promise<TaskCandidateRecord[]> {
    const task = this.requireTask(taskId);

    if (task.status === 'generating') {
      throw new Error('当前任务正在生成候选，请稍后再看结果。');
    }

    if (task.status === 'failed') {
      throw new Error('当前任务生成已失败，阶段 4 不提供完整重试闭环。');
    }

    const existingCandidates = this.listTaskCandidates(taskId);
    if (existingCandidates.length > 0) {
      return existingCandidates;
    }

    this.updateTaskStatus(taskId, 'generating');

    try {
      const memorySnapshot = this.memoryService.getTaskPreparationMemorySnapshot(taskId);
      const assets = this.assetService.listAssetsForTask(taskId);
      const generatedCandidates = await this.aiService.generateTaskCandidates({
        taskId: task.id,
        title: task.title,
        goal: task.goal,
        taskForm: task.taskForm,
        supplementalRequirements: task.supplementalRequirements,
        memorySnapshot,
        assets,
      });

      const storedCandidates = this.replaceCandidates(task, generatedCandidates);
      this.updateTaskStatus(taskId, 'ready');
      return storedCandidates;
    } catch (error) {
      this.updateTaskStatus(taskId, 'failed');
      throw error;
    }
  }

  private replaceCandidates(
    task: TaskRecord,
    generatedCandidates: Array<
      Pick<ArticleTaskCandidateRecord, 'candidateType' | 'title' | 'body'> |
      Pick<VideoTaskCandidateRecord, 'candidateType' | 'title' | 'structuredDescription' | 'segments'>
    >,
  ): TaskCandidateRecord[] {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO task_candidates (
        id,
        task_id,
        candidate_type,
        sequence,
        title,
        body,
        structured_description,
        segments_json,
        generated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const createdIds: string[] = [];
    const applyInsert = this.db.transaction(() => {
      this.db.prepare('DELETE FROM task_candidates WHERE task_id = ?').run(task.id);

      generatedCandidates.forEach((candidate, index) => {
        const id = randomUUID();
        createdIds.push(id);

        if (candidate.candidateType === 'article') {
          const normalized = articleTaskCandidateSchema.parse({
            id,
            taskId: task.id,
            sequence: index + 1,
            title: candidate.title,
            body: candidate.body,
            generatedAt: now,
            candidateType: 'article',
          });

          insert.run(
            normalized.id,
            normalized.taskId,
            normalized.candidateType,
            normalized.sequence,
            normalized.title,
            normalized.body,
            null,
            null,
            normalized.generatedAt,
          );
          return;
        }

        const normalized = videoTaskCandidateSchema.parse({
          id,
          taskId: task.id,
          sequence: index + 1,
          title: candidate.title,
          structuredDescription: candidate.structuredDescription,
          segments: candidate.segments,
          generatedAt: now,
          candidateType: 'video',
        });

        insert.run(
          normalized.id,
          normalized.taskId,
          normalized.candidateType,
          normalized.sequence,
          normalized.title,
          null,
          normalized.structuredDescription,
          JSON.stringify(normalized.segments),
          normalized.generatedAt,
        );
      });
    });

    applyInsert();
    return createdIds
      .map((candidateId) => this.getTaskCandidateById(candidateId))
      .filter((candidate): candidate is TaskCandidateRecord => candidate !== null);
  }

  private getTaskCandidateById(candidateId: string): TaskCandidateRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            task_id,
            candidate_type,
            sequence,
            title,
            body,
            structured_description,
            segments_json,
            generated_at
          FROM task_candidates
          WHERE id = ?
        `,
      )
      .get(candidateId) as TaskCandidateRow | undefined;

    return row ? this.mapCandidateRow(row) : null;
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

  private mapCandidateRow(row: TaskCandidateRow): TaskCandidateRecord {
    if (row.candidate_type === 'article') {
      return taskCandidateSchema.parse({
        id: row.id,
        taskId: row.task_id,
        candidateType: 'article',
        sequence: row.sequence,
        title: row.title,
        body: row.body ?? '',
        generatedAt: row.generated_at,
      });
    }

    return taskCandidateSchema.parse({
      id: row.id,
      taskId: row.task_id,
      candidateType: 'video',
      sequence: row.sequence,
      title: row.title,
      structuredDescription: row.structured_description ?? '',
      segments: JSON.parse(row.segments_json ?? '[]') as unknown[],
      generatedAt: row.generated_at,
    });
  }
}
