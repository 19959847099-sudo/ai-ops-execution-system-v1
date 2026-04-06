import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { articleResultSchema, regenerateFromReviewInputSchema, resultRecordSchema, resultReviewActionSchema, videoResultSchema } from '../../shared/schema/result';
import type { AssetRecord, CreateTextAssetInput } from '../../shared/types/asset';
import type {
  ArticleTaskCandidateRecord,
  TaskCandidateRecord,
  VideoTaskCandidateRecord,
  TaskRecord,
} from '../../shared/types/task';
import type {
  RegenerateFromReviewInput,
  ResultRecord,
  ResultReviewActionRecord,
  ResultStatus,
} from '../../shared/types/result';
import { AssetService } from './asset.service';

type ResultRow = {
  id: string;
  task_id: string;
  project_id: string;
  source_result_id: string | null;
  result_type: 'article' | 'video';
  title: string;
  body: string | null;
  structured_description: string | null;
  segments_json: string | null;
  status: ResultStatus;
  created_at: string;
  updated_at: string;
};

type ReviewActionRow = {
  id: string;
  task_id: string;
  result_id: string;
  action_type: 'approved' | 'regenerated' | 'saved_as_asset';
  note: string;
  related_asset_id: string | null;
  created_at: string;
};

export class ResultService {
  constructor(
    private readonly db: Database.Database,
    private readonly assetService: AssetService,
  ) {}

  listTaskResults(taskId: string): ResultRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            task_id,
            project_id,
            source_result_id,
            result_type,
            title,
            body,
            structured_description,
            segments_json,
            status,
            created_at,
            updated_at
          FROM task_results
          WHERE task_id = ?
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all(taskId) as ResultRow[];

    return rows.map((row) => this.mapResultRow(row));
  }

  listProjectResults(projectId: string): ResultRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            task_id,
            project_id,
            source_result_id,
            result_type,
            title,
            body,
            structured_description,
            segments_json,
            status,
            created_at,
            updated_at
          FROM task_results
          WHERE project_id = ?
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all(projectId) as ResultRow[];

    return rows.map((row) => this.mapResultRow(row));
  }

  listTaskReviewActions(taskId: string): ResultReviewActionRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            task_id,
            result_id,
            action_type,
            note,
            related_asset_id,
            created_at
          FROM result_review_actions
          WHERE task_id = ?
          ORDER BY created_at DESC
        `,
      )
      .all(taskId) as ReviewActionRow[];

    return rows.map((row) => this.mapReviewActionRow(row));
  }

  getResultById(resultId: string): ResultRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            task_id,
            project_id,
            source_result_id,
            result_type,
            title,
            body,
            structured_description,
            segments_json,
            status,
            created_at,
            updated_at
          FROM task_results
          WHERE id = ?
        `,
      )
      .get(resultId) as ResultRow | undefined;

    return row ? this.mapResultRow(row) : null;
  }

  requireResult(resultId: string): ResultRecord {
    const result = this.getResultById(resultId);
    if (!result) {
      throw new Error('结果不存在。');
    }

    return result;
  }

  replaceGeneratedResults(
    task: TaskRecord,
    candidates: TaskCandidateRecord[],
    sourceResultId: string | null,
  ): ResultRecord[] {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO task_results (
        id,
        task_id,
        project_id,
        source_result_id,
        result_type,
        title,
        body,
        structured_description,
        segments_json,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)
    `);

    const createdIds: string[] = [];
    const applyInsert = this.db.transaction(() => {
      candidates.forEach((candidate) => {
        const resultId = randomUUID();
        createdIds.push(resultId);

        if (candidate.candidateType === 'article') {
          const normalized = articleResultSchema.parse({
            id: resultId,
            taskId: task.id,
            projectId: task.projectId,
            sourceResultId,
            resultType: 'article',
            title: candidate.title,
            body: candidate.body,
            status: 'pending_review',
            createdAt: now,
            updatedAt: now,
          });

          insert.run(
            normalized.id,
            normalized.taskId,
            normalized.projectId,
            normalized.sourceResultId,
            normalized.resultType,
            normalized.title,
            normalized.body,
            null,
            null,
            normalized.createdAt,
            normalized.updatedAt,
          );
          return;
        }

        const normalized = videoResultSchema.parse({
          id: resultId,
          taskId: task.id,
          projectId: task.projectId,
          sourceResultId,
          resultType: 'video',
          title: candidate.title,
          structuredDescription: candidate.structuredDescription,
          segments: candidate.segments,
          status: 'pending_review',
          createdAt: now,
          updatedAt: now,
        });

        insert.run(
          normalized.id,
          normalized.taskId,
          normalized.projectId,
          normalized.sourceResultId,
          normalized.resultType,
          normalized.title,
          null,
          normalized.structuredDescription,
          JSON.stringify(normalized.segments),
          normalized.createdAt,
          normalized.updatedAt,
        );
      });
    });

    applyInsert();
    return createdIds
      .map((id) => this.getResultById(id))
      .filter((result): result is ResultRecord => result !== null);
  }

  approveResult(taskId: string, resultId: string, note = ''): ResultRecord {
    const current = this.requireResult(resultId);
    if (current.taskId !== taskId) {
      throw new Error('结果与任务不匹配。');
    }

    const now = new Date().toISOString();
    const actionId = randomUUID();

    const applyApprove = this.db.transaction(() => {
      this.db
        .prepare(
          `
            UPDATE task_results
            SET status = CASE
                  WHEN id = @resultId THEN 'approved'
                  WHEN task_id = @taskId AND status = 'pending_review' THEN 'rejected'
                  ELSE status
                END,
                updated_at = CASE
                  WHEN id = @resultId THEN @updatedAt
                  WHEN task_id = @taskId AND status = 'pending_review' THEN @updatedAt
                  ELSE updated_at
                END
            WHERE task_id = @taskId
          `,
        )
        .run({ resultId, taskId, updatedAt: now });

      this.recordReviewAction({
        id: actionId,
        taskId,
        resultId,
        actionType: 'approved',
        note,
        relatedAssetId: null,
        createdAt: now,
      });
    });

    applyApprove();
    return this.requireResult(resultId);
  }

  markResultRegenerated(taskId: string, resultId: string, input: RegenerateFromReviewInput): ResultRecord {
    const current = this.requireResult(resultId);
    if (current.taskId !== taskId) {
      throw new Error('结果与任务不匹配。');
    }

    const normalized = regenerateFromReviewInputSchema.parse(input);
    const now = new Date().toISOString();
    const actionId = randomUUID();

    const applyReject = this.db.transaction(() => {
      this.db
        .prepare(
          `
            UPDATE task_results
            SET status = 'rejected',
                updated_at = ?
            WHERE id = ?
          `,
        )
        .run(now, resultId);

      this.recordReviewAction({
        id: actionId,
        taskId,
        resultId,
        actionType: 'regenerated',
        note: normalized.note,
        relatedAssetId: null,
        createdAt: now,
      });
    });

    applyReject();
    return this.requireResult(resultId);
  }

  saveResultAsTextAsset(resultId: string): AssetRecord {
    const result = this.requireResult(resultId);
    const textContent = result.resultType === 'article'
      ? result.body
      : [result.structuredDescription, ...result.segments.map((segment) => `${segment.heading}\n${segment.content}`)]
          .join('\n\n')
          .trim();

    const input: CreateTextAssetInput = {
      displayName: `${result.title}-审核文本`,
      textContent,
    };

    const asset = this.assetService.createTextAsset(result.projectId, input);
    const now = new Date().toISOString();

    this.recordReviewAction({
      id: randomUUID(),
      taskId: result.taskId,
      resultId: result.id,
      actionType: 'saved_as_asset',
      note: '',
      relatedAssetId: asset.id,
      createdAt: now,
    });

    return asset;
  }

  toTaskCandidates(results: ResultRecord[]): TaskCandidateRecord[] {
    return results
      .filter((result) => result.status === 'pending_review')
      .map((result, index) => {
        if (result.resultType === 'article') {
          return {
            id: result.id,
            taskId: result.taskId,
            candidateType: 'article',
            sequence: index + 1,
            title: result.title,
            body: result.body,
            generatedAt: result.createdAt,
          } satisfies ArticleTaskCandidateRecord;
        }

        return {
          id: result.id,
          taskId: result.taskId,
          candidateType: 'video',
          sequence: index + 1,
          title: result.title,
          structuredDescription: result.structuredDescription,
          segments: result.segments,
          generatedAt: result.createdAt,
        } satisfies VideoTaskCandidateRecord;
      });
  }

  private recordReviewAction(action: ResultReviewActionRecord): void {
    const normalized = resultReviewActionSchema.parse(action);
    this.db
      .prepare(
        `
          INSERT INTO result_review_actions (
            id,
            task_id,
            result_id,
            action_type,
            note,
            related_asset_id,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        normalized.id,
        normalized.taskId,
        normalized.resultId,
        normalized.actionType,
        normalized.note,
        normalized.relatedAssetId,
        normalized.createdAt,
      );
  }

  private mapResultRow(row: ResultRow): ResultRecord {
    if (row.result_type === 'article') {
      return resultRecordSchema.parse({
        id: row.id,
        taskId: row.task_id,
        projectId: row.project_id,
        sourceResultId: row.source_result_id,
        resultType: 'article',
        title: row.title,
        body: row.body ?? '',
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return resultRecordSchema.parse({
      id: row.id,
      taskId: row.task_id,
      projectId: row.project_id,
      sourceResultId: row.source_result_id,
      resultType: 'video',
      title: row.title,
      structuredDescription: row.structured_description ?? '',
      segments: JSON.parse(row.segments_json ?? '[]') as unknown[],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private mapReviewActionRow(row: ReviewActionRow): ResultReviewActionRecord {
    return resultReviewActionSchema.parse({
      id: row.id,
      taskId: row.task_id,
      resultId: row.result_id,
      actionType: row.action_type,
      note: row.note,
      relatedAssetId: row.related_asset_id,
      createdAt: row.created_at,
    });
  }
}
