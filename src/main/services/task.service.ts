import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createTaskInputSchema } from '../../shared/schema/task';
import type {
  CreateTaskInput,
  TaskCandidateRecord,
  TaskForm,
  TaskLoopStatus,
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
  loop_status: TaskLoopStatus;
  last_failure_at: string | null;
  last_failure_reason: string | null;
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
            loop_status,
            last_failure_at,
            last_failure_reason,
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
            loop_status,
            last_failure_at,
            last_failure_reason,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 'draft', 'pending', NULL, NULL, ?, ?)
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

    return this.requireTask(id);
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
            loop_status,
            last_failure_at,
            last_failure_reason,
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

  async approveResult(taskId: string, resultId: string, note = ''): Promise<ResultRecord> {
    const task = this.requireTask(taskId);
    const approvedResult = this.resultService.approveResult(taskId, resultId, note);

    this.updateTaskLoopStatus(task.id, 'pending', null);
    await this.applyApprovedResultClosure(task, approvedResult);
    return this.resultService.requireResult(approvedResult.id);
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
    this.updateTaskLoopStatus(task.id, 'pending', null);
    return this.runGeneration(task, sourceResultId, input.note.trim());
  }

  async retryTaskClosure(taskId: string): Promise<TaskRecord> {
    const task = this.requireTask(taskId);
    const approvedResult = this.resultService
      .listTaskResults(taskId)
      .find((result) => result.status === 'approved');

    if (!approvedResult) {
      throw new Error('当前任务还没有已通过结果，无法重试闭环。');
    }

    this.updateTaskLoopStatus(task.id, 'pending', null);
    await this.applyApprovedResultClosure(task, approvedResult);
    return this.requireTask(taskId);
  }

  private async runGeneration(
    task: TaskRecord,
    sourceResultId: string | null,
    reviewInstruction: string,
  ): Promise<ResultRecord[]> {
    this.updateTaskGenerationState(task.id, 'generating', null);

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

      if (generatedCandidates.length === 0) {
        throw new Error('当前没有可承接的候选结果。');
      }

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

      this.updateTaskGenerationState(task.id, 'ready', null);
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : '候选生成失败。';
      this.updateTaskGenerationState(task.id, 'failed', message);
      throw error;
    }
  }

  private async applyApprovedResultClosure(task: TaskRecord, approvedResult: ResultRecord): Promise<void> {
    const errors: string[] = [];

    const feedbackPlans = [
      {
        feedbackType: 'title' as const,
        text: approvedResult.title.trim(),
      },
      {
        feedbackType: 'cover_text' as const,
        text: approvedResult.coverText.trim(),
      },
    ];

    for (const plan of feedbackPlans) {
      const existing = this.resultService.getAutoFeedbackByResultAndType(approvedResult.id, plan.feedbackType);
      if (existing?.status === 'completed' && existing.assetId) {
        continue;
      }

      if (!plan.text) {
        this.resultService.upsertAutoFeedbackRecord({
          projectId: approvedResult.projectId,
          taskId: approvedResult.taskId,
          resultId: approvedResult.id,
          feedbackType: plan.feedbackType,
          feedbackText: '',
          assetId: null,
          status: 'failed',
          errorMessage: '当前通过结果没有合法的回流文本来源。',
        });
        errors.push(`${plan.feedbackType === 'title' ? '标题' : '封面文案'}自动回流失败`);
        continue;
      }

      try {
        const asset = this.assetService.createAutoFeedbackAsset(
          approvedResult.projectId,
          plan.feedbackType,
          approvedResult.title,
          plan.text,
        );

        this.resultService.upsertAutoFeedbackRecord({
          projectId: approvedResult.projectId,
          taskId: approvedResult.taskId,
          resultId: approvedResult.id,
          feedbackType: plan.feedbackType,
          feedbackText: plan.text,
          assetId: asset.id,
          status: 'completed',
          errorMessage: '',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '自动回流失败。';
        this.resultService.upsertAutoFeedbackRecord({
          projectId: approvedResult.projectId,
          taskId: approvedResult.taskId,
          resultId: approvedResult.id,
          feedbackType: plan.feedbackType,
          feedbackText: plan.text,
          assetId: null,
          status: 'failed',
          errorMessage: message,
        });
        errors.push(message);
      }
    }

    try {
      this.memoryService.updateRecentTemporaryMemories(task, approvedResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : '最近临时记忆更新失败。';
      errors.push(message);
    }

    if (errors.length > 0) {
      this.updateTaskLoopStatus(task.id, 'failed', errors[0]);
      return;
    }

    this.updateTaskLoopStatus(task.id, 'completed', null);
  }

  private updateTaskGenerationState(taskId: string, status: TaskStatus, failureMessage: string | null): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          UPDATE tasks
          SET status = ?,
              last_failure_at = ?,
              last_failure_reason = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        status,
        failureMessage ? now : null,
        failureMessage,
        now,
        taskId,
      );
  }

  private updateTaskLoopStatus(taskId: string, loopStatus: TaskLoopStatus, failureMessage: string | null): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          UPDATE tasks
          SET loop_status = ?,
              last_failure_at = ?,
              last_failure_reason = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        loopStatus,
        failureMessage ? now : null,
        failureMessage,
        now,
        taskId,
      );
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
      loopStatus: row.loop_status,
      lastFailureAt: row.last_failure_at,
      lastFailureReason: row.last_failure_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
