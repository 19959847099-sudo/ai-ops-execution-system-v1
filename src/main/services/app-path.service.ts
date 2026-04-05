import path from 'node:path';
import type { AppPaths } from '../../shared/types/app';

export class AppPathService {
  constructor(private readonly userDataRoot: string) {}

  getPaths(): AppPaths {
    const appDataDir = path.join(this.userDataRoot, 'app-data');
    const projectRootDir = path.join(appDataDir, 'projects');
    const logsDir = path.join(appDataDir, 'logs');
    const databasePath = path.join(appDataDir, 'ai-ops-execution-system.db');

    return {
      userDataRoot: this.userDataRoot,
      appDataDir,
      projectRootDir,
      logsDir,
      databasePath,
    };
  }
}
