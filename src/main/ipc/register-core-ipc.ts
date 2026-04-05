import { ipcMain } from 'electron';
import {
  CORE_IPC_CHANNELS,
  PROJECT_IPC_CHANNELS,
  SETTINGS_IPC_CHANNELS,
} from '../../shared/ipc/channels';
import type { AppBootstrapSnapshot, AppPaths } from '../../shared/types/app';
import type {
  CreateProjectInput,
  ProjectListFilter,
  UpdateProjectSettingsInput,
} from '../../shared/types/project';
import type {
  EditableResidentUserPreferences,
  EditableSystemSettings,
} from '../../shared/types/settings';
import { SettingsService } from '../services/settings.service';
import { DbService } from '../services/db.service';
import { ProjectService } from '../services/project.service';

type RegisterCoreIpcDeps = {
  dbService: DbService;
  settingsService: SettingsService;
  projectService: ProjectService;
  paths: AppPaths;
  appVersion: string;
};

export function registerCoreIpc({
  dbService,
  settingsService,
  projectService,
  paths,
  appVersion,
}: RegisterCoreIpcDeps): void {
  ipcMain.handle(CORE_IPC_CHANNELS.GET_BOOTSTRAP_SNAPSHOT, () => {
    const snapshot: AppBootstrapSnapshot = {
      appName: 'AI 运营执行系统 V1',
      appVersion,
      paths,
      database: {
        path: paths.databasePath,
        appliedMigrations: dbService.getAppliedMigrations(),
      },
      systemSettings: settingsService.getBootstrapSystemSettings(),
      residentUserPreferences: settingsService.getResidentUserPreferences(),
    };

    return snapshot;
  });

  ipcMain.handle(PROJECT_IPC_CHANNELS.LIST_PROJECTS, (_event, status?: ProjectListFilter) =>
    projectService.listProjects(status),
  );
  ipcMain.handle(PROJECT_IPC_CHANNELS.CREATE_PROJECT, (_event, input: CreateProjectInput) =>
    projectService.createProject(input),
  );
  ipcMain.handle(PROJECT_IPC_CHANNELS.GET_PROJECT_BY_ID, (_event, projectId: string) =>
    projectService.getProjectById(projectId),
  );
  ipcMain.handle(PROJECT_IPC_CHANNELS.ARCHIVE_PROJECT, (_event, projectId: string) =>
    projectService.archiveProject(projectId),
  );
  ipcMain.handle(
    PROJECT_IPC_CHANNELS.UPDATE_PROJECT_SETTINGS,
    (_event, projectId: string, input: UpdateProjectSettingsInput) =>
      projectService.updateProjectSettings(projectId, input),
  );
  ipcMain.handle(SETTINGS_IPC_CHANNELS.GET_SYSTEM_SETTINGS, () =>
    settingsService.getEditableSystemSettings(),
  );
  ipcMain.handle(SETTINGS_IPC_CHANNELS.UPDATE_SYSTEM_SETTINGS, (_event, input: EditableSystemSettings) =>
    settingsService.updateSystemSettings(input),
  );
  ipcMain.handle(SETTINGS_IPC_CHANNELS.TEST_SYSTEM_API, (_event, input: EditableSystemSettings) =>
    settingsService.testCurrentSystemSettings(input),
  );
  ipcMain.handle(SETTINGS_IPC_CHANNELS.GET_USER_PREFERENCES, () =>
    settingsService.getEditableResidentUserPreferences(),
  );
  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.UPDATE_USER_PREFERENCES,
    (_event, input: EditableResidentUserPreferences) =>
      settingsService.updateResidentUserPreferences(input),
  );
}
