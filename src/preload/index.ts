import { contextBridge, ipcRenderer } from 'electron';
import {
  ASSET_IPC_CHANNELS,
  CORE_IPC_CHANNELS,
  MEMORY_IPC_CHANNELS,
  PROJECT_IPC_CHANNELS,
  RESULT_IPC_CHANNELS,
  SETTINGS_IPC_CHANNELS,
  TASK_IPC_CHANNELS,
} from '../shared/ipc/channels';
import type { AppBootstrapSnapshot } from '../shared/types/app';
import type {
  MemoryBridgeApi,
  ProjectResidentMemory,
  RecentTemporaryMemoryRecord,
  TaskPreparationMemorySnapshot,
  UpdateProjectResidentMemoryInput,
  UpdateUserResidentMemoryInput,
  UserResidentMemory,
} from '../shared/types/memory';
import type {
  AssetBridgeApi,
  AssetLibrarySummary,
  AssetListQuery,
  AssetRecord,
  CreateTextAssetInput,
} from '../shared/types/asset';
import type {
  CreateProjectInput,
  ProjectBridgeApi,
  ProjectListFilter,
  ProjectRecord,
  UpdateProjectSettingsInput,
} from '../shared/types/project';
import type {
  EditableResidentUserPreferences,
  EditableSystemSettings,
  SettingsBridgeApi,
  SystemApiTestResult,
} from '../shared/types/settings';
import type {
  RegenerateFromReviewInput,
  ResultAutoFeedbackRecord,
  ResultBridgeApi,
  ResultRecord,
  ResultReviewActionRecord,
} from '../shared/types/result';
import type {
  CreateTaskInput,
  TaskCandidateRecord,
  TaskAssetRecord,
  TaskBridgeApi,
  TaskRecord,
} from '../shared/types/task';

const coreApi = {
  getBootstrapSnapshot(): Promise<AppBootstrapSnapshot> {
    return ipcRenderer.invoke(CORE_IPC_CHANNELS.GET_BOOTSTRAP_SNAPSHOT);
  },
};

const projectApi: ProjectBridgeApi = {
  listProjects(status?: ProjectListFilter): Promise<ProjectRecord[]> {
    return ipcRenderer.invoke(PROJECT_IPC_CHANNELS.LIST_PROJECTS, status);
  },
  createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    return ipcRenderer.invoke(PROJECT_IPC_CHANNELS.CREATE_PROJECT, input);
  },
  getProjectById(projectId: string): Promise<ProjectRecord | null> {
    return ipcRenderer.invoke(PROJECT_IPC_CHANNELS.GET_PROJECT_BY_ID, projectId);
  },
  archiveProject(projectId: string): Promise<ProjectRecord> {
    return ipcRenderer.invoke(PROJECT_IPC_CHANNELS.ARCHIVE_PROJECT, projectId);
  },
  updateProjectSettings(projectId: string, input: UpdateProjectSettingsInput): Promise<ProjectRecord> {
    return ipcRenderer.invoke(PROJECT_IPC_CHANNELS.UPDATE_PROJECT_SETTINGS, projectId, input);
  },
};

const assetApi: AssetBridgeApi = {
  importAssets(projectId: string): Promise<AssetRecord[]> {
    return ipcRenderer.invoke(ASSET_IPC_CHANNELS.IMPORT_ASSETS, projectId);
  },
  createTextAsset(projectId: string, input: CreateTextAssetInput): Promise<AssetRecord> {
    return ipcRenderer.invoke(ASSET_IPC_CHANNELS.CREATE_TEXT_ASSET, projectId, input);
  },
  listAssets(projectId: string, query?: Partial<AssetListQuery>): Promise<AssetRecord[]> {
    return ipcRenderer.invoke(ASSET_IPC_CHANNELS.LIST_ASSETS, projectId, query);
  },
  getAssetById(assetId: string): Promise<AssetRecord | null> {
    return ipcRenderer.invoke(ASSET_IPC_CHANNELS.GET_ASSET_BY_ID, assetId);
  },
  getAssetLibrarySummary(projectId: string): Promise<AssetLibrarySummary> {
    return ipcRenderer.invoke(ASSET_IPC_CHANNELS.GET_LIBRARY_SUMMARY, projectId);
  },
};

const taskApi: TaskBridgeApi = {
  listTasks(projectId: string): Promise<TaskRecord[]> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.LIST_TASKS, projectId);
  },
  createTask(projectId: string, input: CreateTaskInput): Promise<TaskRecord> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.CREATE_TASK, projectId, input);
  },
  getTaskById(taskId: string): Promise<TaskRecord | null> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.GET_TASK_BY_ID, taskId);
  },
  listTaskCandidates(taskId: string): Promise<TaskCandidateRecord[]> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.LIST_TASK_CANDIDATES, taskId);
  },
  generateTaskCandidates(taskId: string): Promise<TaskCandidateRecord[]> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.GENERATE_TASK_CANDIDATES, taskId);
  },
  retryTaskClosure(taskId: string): Promise<TaskRecord> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.RETRY_TASK_CLOSURE, taskId);
  },
  listTaskAssets(taskId: string): Promise<TaskAssetRecord[]> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.LIST_TASK_ASSETS, taskId);
  },
  attachAsset(taskId: string, assetId: string): Promise<TaskAssetRecord> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.ATTACH_ASSET, taskId, assetId);
  },
  removeAsset(taskId: string, assetId: string): Promise<void> {
    return ipcRenderer.invoke(TASK_IPC_CHANNELS.REMOVE_ASSET, taskId, assetId);
  },
};

const memoryApi: MemoryBridgeApi = {
  getProjectResidentMemory(projectId: string): Promise<ProjectResidentMemory> {
    return ipcRenderer.invoke(MEMORY_IPC_CHANNELS.GET_PROJECT_RESIDENT_MEMORY, projectId);
  },
  updateProjectResidentMemory(
    projectId: string,
    input: UpdateProjectResidentMemoryInput,
  ): Promise<ProjectResidentMemory> {
    return ipcRenderer.invoke(MEMORY_IPC_CHANNELS.UPDATE_PROJECT_RESIDENT_MEMORY, projectId, input);
  },
  getUserResidentMemory(): Promise<UserResidentMemory> {
    return ipcRenderer.invoke(MEMORY_IPC_CHANNELS.GET_USER_RESIDENT_MEMORY);
  },
  updateUserResidentMemory(input: UpdateUserResidentMemoryInput): Promise<UserResidentMemory> {
    return ipcRenderer.invoke(MEMORY_IPC_CHANNELS.UPDATE_USER_RESIDENT_MEMORY, input);
  },
  getTaskPreparationMemorySnapshot(taskId: string): Promise<TaskPreparationMemorySnapshot> {
    return ipcRenderer.invoke(MEMORY_IPC_CHANNELS.GET_TASK_PREPARATION_SNAPSHOT, taskId);
  },
  listRecentTemporaryMemories(projectId: string): Promise<RecentTemporaryMemoryRecord[]> {
    return ipcRenderer.invoke(MEMORY_IPC_CHANNELS.LIST_RECENT_TEMPORARY_MEMORIES, projectId);
  },
};

const settingsApi: SettingsBridgeApi = {
  getSystemSettings(): Promise<EditableSystemSettings> {
    return ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.GET_SYSTEM_SETTINGS);
  },
  updateSystemSettings(input: EditableSystemSettings): Promise<EditableSystemSettings> {
    return ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.UPDATE_SYSTEM_SETTINGS, input);
  },
  testSystemApi(input: EditableSystemSettings): Promise<SystemApiTestResult> {
    return ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.TEST_SYSTEM_API, input);
  },
  getUserPreferences(): Promise<EditableResidentUserPreferences> {
    return ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.GET_USER_PREFERENCES);
  },
  updateUserPreferences(
    input: EditableResidentUserPreferences,
  ): Promise<EditableResidentUserPreferences> {
    return ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.UPDATE_USER_PREFERENCES, input);
  },
};

const resultApi: ResultBridgeApi = {
  listTaskResults(taskId: string): Promise<ResultRecord[]> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.LIST_TASK_RESULTS, taskId);
  },
  listProjectResults(projectId: string): Promise<ResultRecord[]> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.LIST_PROJECT_RESULTS, projectId);
  },
  listTaskReviewActions(taskId: string): Promise<ResultReviewActionRecord[]> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.LIST_TASK_REVIEW_ACTIONS, taskId);
  },
  listTaskAutoFeedbacks(taskId: string): Promise<ResultAutoFeedbackRecord[]> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.LIST_TASK_AUTO_FEEDBACKS, taskId);
  },
  listProjectAutoFeedbacks(projectId: string): Promise<ResultAutoFeedbackRecord[]> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.LIST_PROJECT_AUTO_FEEDBACKS, projectId);
  },
  approveResult(taskId: string, resultId: string, note?: string): Promise<ResultRecord> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.APPROVE_RESULT, taskId, resultId, note);
  },
  regenerateResult(
    taskId: string,
    resultId: string,
    input: RegenerateFromReviewInput,
  ): Promise<ResultRecord[]> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.REGENERATE_RESULT, taskId, resultId, input);
  },
  saveResultAsTextAsset(resultId: string): Promise<AssetRecord> {
    return ipcRenderer.invoke(RESULT_IPC_CHANNELS.SAVE_RESULT_AS_TEXT_ASSET, resultId);
  },
};

contextBridge.exposeInMainWorld('coreApi', coreApi);
contextBridge.exposeInMainWorld('projectApi', projectApi);
contextBridge.exposeInMainWorld('assetApi', assetApi);
contextBridge.exposeInMainWorld('taskApi', taskApi);
contextBridge.exposeInMainWorld('memoryApi', memoryApi);
contextBridge.exposeInMainWorld('resultApi', resultApi);
contextBridge.exposeInMainWorld('settingsApi', settingsApi);
