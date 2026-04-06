import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { recentTemporaryMemoryRecordSchema, taskPreparationMemorySnapshotSchema } from '../../shared/schema/memory';
import type { TaskPreparationMemorySnapshot, RecentTemporaryMemoryRecord } from '../../shared/types/memory';
import type { ResultRecord } from '../../shared/types/result';
import type { TaskRecord } from '../../shared/types/task';
import { ProjectService } from './project.service';
import { SettingsService } from './settings.service';

type TaskSnapshotRow = {
  id: string;
  project_id: string;
  title: string;
};

type RecentMemoryRow = {
  id: string;
  project_id: string;
  task_id: string;
  result_id: string;
  summary_text: string;
  created_at: string;
  expires_at: string;
};

const MAX_RECENT_MEMORIES = 20;
const RECENT_MEMORY_TTL_DAYS = 14;
const MAX_NEW_SUMMARIES_PER_APPROVAL = 4;

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
      recentTemporaryMemories: this.listRecentTemporaryMemories(task.project_id),
    });
  }

  listRecentTemporaryMemories(projectId: string): RecentTemporaryMemoryRecord[] {
    this.ensureProjectExists(projectId);
    this.cleanupExpiredRecentTemporaryMemories(projectId);

    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            project_id,
            task_id,
            result_id,
            summary_text,
            created_at,
            expires_at
          FROM recent_temporary_memories
          WHERE project_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `,
      )
      .all(projectId, MAX_RECENT_MEMORIES) as RecentMemoryRow[];

    return rows.map((row) => this.mapRecentMemoryRow(row));
  }

  updateRecentTemporaryMemories(task: TaskRecord, approvedResult: ResultRecord): RecentTemporaryMemoryRecord[] {
    this.ensureProjectExists(task.projectId);

    const summaries = this.buildRecentMemorySummaries(task, approvedResult).slice(0, MAX_NEW_SUMMARIES_PER_APPROVAL);
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + RECENT_MEMORY_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO recent_temporary_memories (
        id,
        project_id,
        task_id,
        result_id,
        summary_text,
        created_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertedIds: string[] = [];
    const applyUpdate = this.db.transaction(() => {
      summaries.forEach((summary) => {
        const id = randomUUID();
        const result = insert.run(
          id,
          task.projectId,
          task.id,
          approvedResult.id,
          summary,
          createdAt,
          expiresAt,
        );

        if (result.changes > 0) {
          insertedIds.push(id);
        }
      });

      this.cleanupExpiredRecentTemporaryMemories(task.projectId);
      this.trimRecentTemporaryMemories(task.projectId);
    });

    applyUpdate();
    return insertedIds
      .map((id) => this.getRecentTemporaryMemoryById(id))
      .filter((memory): memory is RecentTemporaryMemoryRecord => memory !== null);
  }

  private getRecentTemporaryMemoryById(memoryId: string): RecentTemporaryMemoryRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            project_id,
            task_id,
            result_id,
            summary_text,
            created_at,
            expires_at
          FROM recent_temporary_memories
          WHERE id = ?
        `,
      )
      .get(memoryId) as RecentMemoryRow | undefined;

    return row ? this.mapRecentMemoryRow(row) : null;
  }

  private cleanupExpiredRecentTemporaryMemories(projectId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          DELETE FROM recent_temporary_memories
          WHERE project_id = ?
            AND expires_at <= ?
        `,
      )
      .run(projectId, now);
  }

  private trimRecentTemporaryMemories(projectId: string): void {
    this.db
      .prepare(
        `
          DELETE FROM recent_temporary_memories
          WHERE project_id = ?
            AND id NOT IN (
              SELECT id
              FROM recent_temporary_memories
              WHERE project_id = ?
              ORDER BY created_at DESC
              LIMIT ?
            )
        `,
      )
      .run(projectId, projectId, MAX_RECENT_MEMORIES);
  }

  private buildRecentMemorySummaries(task: TaskRecord, approvedResult: ResultRecord): string[] {
    const summaries = [
      `已通过${task.taskForm === 'article' ? '图文' : '视频'}任务：${this.truncateText(approvedResult.title, 40)}`,
    ];

    if (approvedResult.coverText.trim()) {
      summaries.push(`封面文案：${this.truncateText(approvedResult.coverText, 48)}`);
    }

    summaries.push(`任务目标：${this.truncateText(task.goal, 48)}`);

    if (approvedResult.resultType === 'article') {
      summaries.push(`正文方向：${this.truncateText(approvedResult.body, 48)}`);
    } else {
      summaries.push(`视频说明：${this.truncateText(approvedResult.structuredDescription, 48)}`);
    }

    return Array.from(new Set(summaries.filter((summary) => summary.trim())));
  }

  private truncateText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  private ensureProjectExists(projectId: string): void {
    if (!this.projectService.getProjectById(projectId)) {
      throw new Error('项目不存在。');
    }
  }

  private mapRecentMemoryRow(row: RecentMemoryRow): RecentTemporaryMemoryRecord {
    return recentTemporaryMemoryRecordSchema.parse({
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      resultId: row.result_id,
      summaryText: row.summary_text,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    });
  }
}
