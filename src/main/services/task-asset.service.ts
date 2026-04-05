import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { TaskAssetRecord } from '../../shared/types/task';
import { AssetService } from './asset.service';
import { TaskService } from './task.service';

type TaskAssetRow = {
  id: string;
  task_id: string;
  asset_id: string;
  added_at: string;
  sort_order: number;
};

export class TaskAssetService {
  constructor(
    private readonly db: Database.Database,
    private readonly taskService: TaskService,
    private readonly assetService: AssetService,
  ) {}

  listTaskAssets(taskId: string): TaskAssetRecord[] {
    this.taskService.requireTask(taskId);
    const rows = this.db
      .prepare(
        `
          SELECT id, task_id, asset_id, added_at, sort_order
          FROM task_assets
          WHERE task_id = ?
          ORDER BY sort_order ASC, added_at ASC
        `,
      )
      .all(taskId) as TaskAssetRow[];

    return rows.map((row) => this.mapRow(row));
  }

  attachAsset(taskId: string, assetId: string): TaskAssetRecord {
    const task = this.taskService.requireTask(taskId);
    const asset = this.assetService.requireAsset(assetId);
    if (task.projectId !== asset.projectId) {
      throw new Error('素材和任务不属于同一个项目。');
    }

    const existing = this.db
      .prepare(
        `
          SELECT id, task_id, asset_id, added_at, sort_order
          FROM task_assets
          WHERE task_id = ? AND asset_id = ?
        `,
      )
      .get(taskId, assetId) as TaskAssetRow | undefined;

    const usedAt = new Date().toISOString();

    if (existing) {
      this.assetService.markAssetUsed(assetId, usedAt);
      return this.mapRow(existing);
    }

    const nextOrderRow = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM task_assets WHERE task_id = ?')
      .get(taskId) as { max_sort_order: number };
    const relationId = randomUUID();

    const applyInsert = this.db.transaction(() => {
      this.db
        .prepare(
          `
            INSERT INTO task_assets (id, task_id, asset_id, added_at, sort_order)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(relationId, taskId, assetId, usedAt, nextOrderRow.max_sort_order + 1);
      this.assetService.markAssetUsed(assetId, usedAt);
    });

    applyInsert();

    const inserted = this.db
      .prepare(
        `
          SELECT id, task_id, asset_id, added_at, sort_order
          FROM task_assets
          WHERE id = ?
        `,
      )
      .get(relationId) as TaskAssetRow | undefined;

    if (!inserted) {
      throw new Error('任务素材关系创建后读取失败。');
    }

    return this.mapRow(inserted);
  }

  removeAsset(taskId: string, assetId: string): void {
    this.taskService.requireTask(taskId);
    this.db.prepare('DELETE FROM task_assets WHERE task_id = ? AND asset_id = ?').run(taskId, assetId);
  }

  private mapRow(row: TaskAssetRow): TaskAssetRecord {
    const asset = this.assetService.requireAsset(row.asset_id);

    return {
      id: row.id,
      taskId: row.task_id,
      assetId: row.asset_id,
      addedAt: row.added_at,
      sortOrder: row.sort_order,
      asset,
    };
  }
}
