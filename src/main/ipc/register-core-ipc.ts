import { dialog, ipcMain } from 'electron';
import {
  ASSET_IPC_CHANNELS,
  CORE_IPC_CHANNELS,
  MEMORY_IPC_CHANNELS,
  PROJECT_IPC_CHANNELS,
  RESULT_IPC_CHANNELS,
  SETTINGS_IPC_CHANNELS,
  TASK_IPC_CHANNELS,
} from '../../shared/ipc/channels';
import type { AssetListQuery, CreateTextAssetInput } from '../../shared/types/asset';
import type { AppBootstrapSnapshot, AppPaths } from '../../shared/types/app';
import type {
  UpdateProjectResidentMemoryInput,
  UpdateUserResidentMemoryInput,
} from '../../shared/types/memory';
import type {
  CreateProjectInput,
  ProjectListFilter,
  UpdateProjectSettingsInput,
} from '../../shared/types/project';
import type {
  EditableResidentUserPreferences,
  EditableSystemSettings,
} from '../../shared/types/settings';
import type { CreateTaskInput } from '../../shared/types/task';
import type { RegenerateFromReviewInput } from '../../shared/types/result';
import { AssetService } from '../services/asset.service';
import { SettingsService } from '../services/settings.service';
import { DbService } from '../services/db.service';
import { ProjectService } from '../services/project.service';
import { TaskAssetService } from '../services/task-asset.service';
import { TaskService } from '../services/task.service';
import { MemoryService } from '../services/memory.service';
import { ResultService } from '../services/result.service';

type RegisterCoreIpcDeps = {
  dbService: DbService;
  settingsService: SettingsService;
  projectService: ProjectService;
  assetService: AssetService;
  taskService: TaskService;
  taskAssetService: TaskAssetService;
  memoryService: MemoryService;
  resultService: ResultService;
  paths: AppPaths;
  appVersion: string;
};

export function registerCoreIpc({
  dbService,
  settingsService,
  projectService,
  assetService,
  taskService,
  taskAssetService,
  memoryService,
  resultService,
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

  ipcMain.handle(ASSET_IPC_CHANNELS.IMPORT_ASSETS, async (_event, projectId: string) => {
    const result = await dialog.showOpenDialog({
      title: '导入素材',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: '图片与视频',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'mp4', 'mov', 'm4v', 'webm'],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    return assetService.importFiles(projectId, result.filePaths);
  });
  ipcMain.handle(
    ASSET_IPC_CHANNELS.CREATE_TEXT_ASSET,
    (_event, projectId: string, input: CreateTextAssetInput) =>
      assetService.createTextAsset(projectId, input),
  );
  ipcMain.handle(
    ASSET_IPC_CHANNELS.LIST_ASSETS,
    (_event, projectId: string, query?: Partial<AssetListQuery>) =>
      assetService.listAssets(projectId, query),
  );
  ipcMain.handle(ASSET_IPC_CHANNELS.GET_ASSET_BY_ID, (_event, assetId: string) =>
    assetService.getAssetById(assetId),
  );
  ipcMain.handle(ASSET_IPC_CHANNELS.GET_LIBRARY_SUMMARY, (_event, projectId: string) =>
    assetService.getAssetLibrarySummary(projectId),
  );

  ipcMain.handle(TASK_IPC_CHANNELS.LIST_TASKS, (_event, projectId: string) =>
    taskService.listTasks(projectId),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.CREATE_TASK, (_event, projectId: string, input: CreateTaskInput) =>
    taskService.createTask(projectId, input),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.GET_TASK_BY_ID, (_event, taskId: string) =>
    taskService.getTaskById(taskId),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.LIST_TASK_CANDIDATES, (_event, taskId: string) =>
    taskService.listTaskCandidates(taskId),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.GENERATE_TASK_CANDIDATES, (_event, taskId: string) =>
    taskService.generateTaskCandidates(taskId),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.RETRY_TASK_CLOSURE, (_event, taskId: string) =>
    taskService.retryTaskClosure(taskId),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.LIST_TASK_ASSETS, (_event, taskId: string) =>
    taskAssetService.listTaskAssets(taskId),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.ATTACH_ASSET, (_event, taskId: string, assetId: string) =>
    taskAssetService.attachAsset(taskId, assetId),
  );
  ipcMain.handle(TASK_IPC_CHANNELS.REMOVE_ASSET, (_event, taskId: string, assetId: string) =>
    taskAssetService.removeAsset(taskId, assetId),
  );

  ipcMain.handle(MEMORY_IPC_CHANNELS.GET_PROJECT_RESIDENT_MEMORY, (_event, projectId: string) =>
    projectService.getProjectResidentMemory(projectId),
  );
  ipcMain.handle(
    MEMORY_IPC_CHANNELS.UPDATE_PROJECT_RESIDENT_MEMORY,
    (_event, projectId: string, input: UpdateProjectResidentMemoryInput) =>
      projectService.updateProjectResidentMemory(projectId, input),
  );
  ipcMain.handle(MEMORY_IPC_CHANNELS.GET_USER_RESIDENT_MEMORY, () =>
    settingsService.getUserResidentMemory(),
  );
  ipcMain.handle(
    MEMORY_IPC_CHANNELS.UPDATE_USER_RESIDENT_MEMORY,
    (_event, input: UpdateUserResidentMemoryInput) => settingsService.updateUserResidentMemory(input),
  );
  ipcMain.handle(MEMORY_IPC_CHANNELS.GET_TASK_PREPARATION_SNAPSHOT, (_event, taskId: string) =>
    memoryService.getTaskPreparationMemorySnapshot(taskId),
  );
  ipcMain.handle(MEMORY_IPC_CHANNELS.LIST_RECENT_TEMPORARY_MEMORIES, (_event, projectId: string) =>
    memoryService.listRecentTemporaryMemories(projectId),
  );

  ipcMain.handle(RESULT_IPC_CHANNELS.LIST_TASK_RESULTS, (_event, taskId: string) =>
    resultService.listTaskResults(taskId),
  );
  ipcMain.handle(RESULT_IPC_CHANNELS.LIST_PROJECT_RESULTS, (_event, projectId: string) =>
    resultService.listProjectResults(projectId),
  );
  ipcMain.handle(RESULT_IPC_CHANNELS.LIST_TASK_REVIEW_ACTIONS, (_event, taskId: string) =>
    resultService.listTaskReviewActions(taskId),
  );
  ipcMain.handle(RESULT_IPC_CHANNELS.LIST_TASK_AUTO_FEEDBACKS, (_event, taskId: string) =>
    resultService.listTaskAutoFeedbacks(taskId),
  );
  ipcMain.handle(RESULT_IPC_CHANNELS.LIST_PROJECT_AUTO_FEEDBACKS, (_event, projectId: string) =>
    resultService.listProjectAutoFeedbacks(projectId),
  );
  ipcMain.handle(RESULT_IPC_CHANNELS.APPROVE_RESULT, (_event, taskId: string, resultId: string, note?: string) =>
    taskService.approveResult(taskId, resultId, note),
  );
  ipcMain.handle(
    RESULT_IPC_CHANNELS.REGENERATE_RESULT,
    (_event, taskId: string, resultId: string, input: RegenerateFromReviewInput) =>
      taskService.regenerateTaskResults(taskId, resultId, input),
  );
  ipcMain.handle(RESULT_IPC_CHANNELS.SAVE_RESULT_AS_TEXT_ASSET, (_event, resultId: string) =>
    resultService.saveResultAsTextAsset(resultId),
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
