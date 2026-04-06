import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  assetListQuerySchema,
  assetTypeSchema,
  createTextAssetInputSchema,
} from '../../shared/schema/asset';
import type {
  AssetLibrarySummary,
  AssetListQuery,
  AssetRecord,
  AssetStatus,
  AssetType,
  CreateTextAssetInput,
} from '../../shared/types/asset';
import { ProjectService } from './project.service';
import { AssetStorageService } from './asset-storage.service';

type AssetRow = {
  id: string;
  project_id: string;
  file_name: string;
  display_name: string;
  asset_type: AssetType;
  mime_type: string;
  file_extension: string;
  file_size: number;
  relative_path: string;
  text_content: string | null;
  status: AssetStatus;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

type AssetSummaryRow = {
  total_count: number;
  image_count: number;
  video_count: number;
  text_count: number;
  last_imported_at: string | null;
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);

export class AssetService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly assetStorageService: AssetStorageService,
  ) {}

  listAssets(projectId: string, query: Partial<AssetListQuery> = {}): AssetRecord[] {
    this.ensureProjectExists(projectId);
    const normalized = assetListQuerySchema.parse(query);
    const whereParts = ['project_id = @projectId'];
    const params: Record<string, string> = { projectId };

    if (normalized.type !== 'all') {
      whereParts.push('asset_type = @assetType');
      params.assetType = normalized.type;
    }

    if (normalized.keyword) {
      whereParts.push(
        "(display_name LIKE @keyword OR file_name LIKE @keyword OR COALESCE(text_content, '') LIKE @keyword)",
      );
      params.keyword = `%${normalized.keyword}%`;
    }

    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            project_id,
            file_name,
            display_name,
            asset_type,
            mime_type,
            file_extension,
            file_size,
            relative_path,
            text_content,
            status,
            last_used_at,
            created_at,
            updated_at
          FROM assets
          WHERE ${whereParts.join(' AND ')}
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all(params) as AssetRow[];

    return rows.map((row) => this.mapRow(row));
  }

  getAssetById(assetId: string): AssetRecord | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            project_id,
            file_name,
            display_name,
            asset_type,
            mime_type,
            file_extension,
            file_size,
            relative_path,
            text_content,
            status,
            last_used_at,
            created_at,
            updated_at
          FROM assets
          WHERE id = ?
        `,
      )
      .get(assetId) as AssetRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  listAssetsForTask(taskId: string): AssetRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            a.id,
            a.project_id,
            a.file_name,
            a.display_name,
            a.asset_type,
            a.mime_type,
            a.file_extension,
            a.file_size,
            a.relative_path,
            a.text_content,
            a.status,
            a.last_used_at,
            a.created_at,
            a.updated_at
          FROM task_assets ta
          INNER JOIN assets a ON a.id = ta.asset_id
          WHERE ta.task_id = ?
          ORDER BY ta.sort_order ASC, ta.added_at ASC
        `,
      )
      .all(taskId) as AssetRow[];

    return rows.map((row) => this.mapRow(row));
  }

  importFiles(projectId: string, filePaths: string[]): AssetRecord[] {
    this.ensureProjectExists(projectId);
    if (filePaths.length === 0) {
      return [];
    }

    const insertedIds: string[] = [];
    const insertAsset = this.db.prepare(`
      INSERT INTO assets (
        id,
        project_id,
        file_name,
        display_name,
        asset_type,
        mime_type,
        file_extension,
        file_size,
        relative_path,
        text_content,
        status,
        last_used_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'ready', NULL, ?, ?)
    `);

    const applyImport = this.db.transaction((pathsToImport: string[]) => {
      for (const filePath of pathsToImport) {
        const sourceStats = fs.statSync(filePath);
        if (!sourceStats.isFile()) {
          throw new Error('仅支持导入本地文件。');
        }

        const originalFileName = path.basename(filePath);
        const fileExtension = path.extname(originalFileName).replace('.', '').toLowerCase();
        const assetType = this.detectAssetType(fileExtension);
        const mimeType = this.detectMimeType(assetType, fileExtension);
        const displayName = path.parse(originalFileName).name;
        const id = randomUUID();
        const storedFileName = `${id}${fileExtension ? `.${fileExtension}` : ''}`;
        const now = new Date().toISOString();
        const storedFile = this.assetStorageService.copyImportedFile(projectId, filePath, storedFileName);

        insertAsset.run(
          id,
          projectId,
          originalFileName,
          displayName,
          assetType,
          mimeType,
          fileExtension,
          storedFile.fileSize,
          storedFile.relativePath,
          now,
          now,
        );
        insertedIds.push(id);
      }
    });

    applyImport(filePaths);
    return insertedIds
      .map((assetId) => this.getAssetById(assetId))
      .filter((asset): asset is AssetRecord => asset !== null);
  }

  createTextAsset(projectId: string, input: CreateTextAssetInput): AssetRecord {
    this.ensureProjectExists(projectId);
    const normalized = createTextAssetInputSchema.parse(input);
    const id = randomUUID();
    const fileBaseName = this.sanitizeFileName(normalized.displayName) || 'text-asset';
    const storedFileName = `${fileBaseName}-${id.slice(0, 8)}.txt`;
    const now = new Date().toISOString();
    const storedFile = this.assetStorageService.writeTextAssetFile(
      projectId,
      storedFileName,
      normalized.textContent,
    );

    this.db
      .prepare(
        `
          INSERT INTO assets (
            id,
            project_id,
            file_name,
            display_name,
            asset_type,
            mime_type,
            file_extension,
            file_size,
            relative_path,
            text_content,
            status,
            last_used_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, 'text', 'text/plain', 'txt', ?, ?, ?, 'ready', NULL, ?, ?)
        `,
      )
      .run(
        id,
        projectId,
        storedFileName,
        normalized.displayName,
        storedFile.fileSize,
        storedFile.relativePath,
        normalized.textContent,
        now,
        now,
      );

    const asset = this.getAssetById(id);
    if (!asset) {
      throw new Error('文本素材创建后读取失败。');
    }

    return asset;
  }

  getAssetLibrarySummary(projectId: string): AssetLibrarySummary {
    this.ensureProjectExists(projectId);
    const row = this.db
      .prepare(
        `
          SELECT
            COUNT(*) AS total_count,
            SUM(CASE WHEN asset_type = 'image' THEN 1 ELSE 0 END) AS image_count,
            SUM(CASE WHEN asset_type = 'video' THEN 1 ELSE 0 END) AS video_count,
            SUM(CASE WHEN asset_type = 'text' THEN 1 ELSE 0 END) AS text_count,
            MAX(created_at) AS last_imported_at
          FROM assets
          WHERE project_id = ?
        `,
      )
      .get(projectId) as AssetSummaryRow | undefined;

    return {
      totalCount: row?.total_count ?? 0,
      imageCount: row?.image_count ?? 0,
      videoCount: row?.video_count ?? 0,
      textCount: row?.text_count ?? 0,
      lastImportedAt: row?.last_imported_at ?? null,
    };
  }

  markAssetUsed(assetId: string, usedAt: string): void {
    const existing = this.getAssetById(assetId);
    if (!existing) {
      throw new Error('素材不存在。');
    }

    this.db
      .prepare(
        `
          UPDATE assets
          SET last_used_at = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(usedAt, usedAt, assetId);
  }

  requireAsset(assetId: string): AssetRecord {
    const asset = this.getAssetById(assetId);
    if (!asset) {
      throw new Error('素材不存在。');
    }

    return asset;
  }

  private ensureProjectExists(projectId: string): void {
    if (!this.projectService.getProjectById(projectId)) {
      throw new Error('项目不存在。');
    }
  }

  private detectAssetType(fileExtension: string): AssetType {
    if (IMAGE_EXTENSIONS.has(fileExtension)) {
      return assetTypeSchema.parse('image');
    }

    if (VIDEO_EXTENSIONS.has(fileExtension)) {
      return assetTypeSchema.parse('video');
    }

    throw new Error('当前仅支持导入图片或视频文件。');
  }

  private detectMimeType(assetType: AssetType, fileExtension: string): string {
    if (assetType === 'image') {
      if (fileExtension === 'jpg') {
        return 'image/jpeg';
      }

      return `image/${fileExtension}`;
    }

    if (fileExtension === 'mov') {
      return 'video/quicktime';
    }

    return `video/${fileExtension}`;
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').trim().replace(/\s+/g, '-');
  }

  private mapRow(row: AssetRow): AssetRecord {
    const absolutePath = this.assetStorageService.resolveAbsolutePath(row.relative_path);

    return {
      id: row.id,
      projectId: row.project_id,
      fileName: row.file_name,
      displayName: row.display_name,
      assetType: row.asset_type,
      mimeType: row.mime_type,
      fileExtension: row.file_extension,
      fileSize: row.file_size,
      relativePath: row.relative_path,
      absolutePath,
      fileUrl: pathToFileURL(absolutePath).toString(),
      textContent: row.text_content,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at,
    };
  }
}
