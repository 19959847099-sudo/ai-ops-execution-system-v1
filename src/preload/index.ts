import { contextBridge, ipcRenderer } from 'electron';
import {
  CORE_IPC_CHANNELS,
  PROJECT_IPC_CHANNELS,
  SETTINGS_IPC_CHANNELS,
} from '../shared/ipc/channels';
import type { AppBootstrapSnapshot } from '../shared/types/app';
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

contextBridge.exposeInMainWorld('coreApi', coreApi);
contextBridge.exposeInMainWorld('projectApi', projectApi);
contextBridge.exposeInMainWorld('settingsApi', settingsApi);
