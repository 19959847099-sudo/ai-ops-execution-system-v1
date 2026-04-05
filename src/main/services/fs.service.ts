import fs from 'node:fs';
import path from 'node:path';
import type { AppPaths } from '../../shared/types/app';

export class FsService {
  ensureDir(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  ensureBaseStructure(paths: AppPaths): void {
    this.ensureDir(paths.appDataDir);
    this.ensureDir(paths.projectRootDir);
    this.ensureDir(paths.logsDir);
  }

  readJsonFile<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  }

  writeJsonFile(filePath: string, value: unknown): void {
    this.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
  }
}
