import type {
  CreateProjectInput,
  ProjectListFilter,
  ProjectRecord,
  UpdateProjectSettingsInput,
} from './project';
import type {
  BootstrapSystemSettings,
  ResidentUserPreferences,
} from './settings';

export type AppPaths = {
  userDataRoot: string;
  appDataDir: string;
  projectRootDir: string;
  logsDir: string;
  databasePath: string;
};

export type AppBootstrapSnapshot = {
  appName: string;
  appVersion: string;
  paths: AppPaths;
  database: {
    path: string;
    appliedMigrations: string[];
  };
  systemSettings: BootstrapSystemSettings;
  residentUserPreferences: ResidentUserPreferences;
};

export type CoreBridgeApi = {
  getBootstrapSnapshot(): Promise<AppBootstrapSnapshot>;
};

export type ProjectServiceContract = {
  getTableName(): string;
  listProjects(status?: ProjectListFilter): ProjectRecord[];
  createProject(input: CreateProjectInput): ProjectRecord;
  getProjectById(projectId: string): ProjectRecord | null;
  archiveProject(projectId: string): ProjectRecord;
  updateProjectSettings(projectId: string, input: UpdateProjectSettingsInput): ProjectRecord;
};
