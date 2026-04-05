import fs from 'node:fs';
import path from 'node:path';
import type { AppPaths } from '../../shared/types/app';
import { FsService } from './fs.service';

type StoredAssetFile = {
  relativePath: string;
  absolutePath: string;
  fileSize: number;
};

export class AssetStorageService {
  constructor(
    private readonly paths: AppPaths,
    private readonly fsService: FsService,
  ) {}

  ensureProjectAssetDir(projectId: string): string {
    const projectDir = path.join(this.paths.projectRootDir, projectId);
    const assetDir = path.join(projectDir, 'assets');
    this.fsService.ensureDir(projectDir);
    this.fsService.ensureDir(assetDir);
    return assetDir;
  }

  copyImportedFile(projectId: string, sourcePath: string, storedFileName: string): StoredAssetFile {
    const assetDir = this.ensureProjectAssetDir(projectId);
    const absolutePath = path.join(assetDir, storedFileName);
    fs.copyFileSync(sourcePath, absolutePath);
    const stats = fs.statSync(absolutePath);

    return {
      relativePath: this.toRelativeAssetPath(projectId, storedFileName),
      absolutePath,
      fileSize: stats.size,
    };
  }

  writeTextAssetFile(projectId: string, storedFileName: string, content: string): StoredAssetFile {
    const assetDir = this.ensureProjectAssetDir(projectId);
    const absolutePath = path.join(assetDir, storedFileName);
    fs.writeFileSync(absolutePath, content, 'utf-8');
    const stats = fs.statSync(absolutePath);

    return {
      relativePath: this.toRelativeAssetPath(projectId, storedFileName),
      absolutePath,
      fileSize: stats.size,
    };
  }

  resolveAbsolutePath(relativePath: string): string {
    return path.join(this.paths.projectRootDir, relativePath);
  }

  private toRelativeAssetPath(projectId: string, storedFileName: string): string {
    return path.join(projectId, 'assets', storedFileName).replace(/\\/g, '/');
  }
}

