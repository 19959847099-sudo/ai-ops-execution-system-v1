export const CORE_IPC_CHANNELS = {
  GET_BOOTSTRAP_SNAPSHOT: 'core:get-bootstrap-snapshot',
} as const;

export const PROJECT_IPC_CHANNELS = {
  LIST_PROJECTS: 'project:list',
  CREATE_PROJECT: 'project:create',
  GET_PROJECT_BY_ID: 'project:get-by-id',
  ARCHIVE_PROJECT: 'project:archive',
  UPDATE_PROJECT_SETTINGS: 'project:update-settings',
} as const;

export const ASSET_IPC_CHANNELS = {
  IMPORT_ASSETS: 'asset:import-files',
  CREATE_TEXT_ASSET: 'asset:create-text',
  LIST_ASSETS: 'asset:list',
  GET_ASSET_BY_ID: 'asset:get-by-id',
  GET_LIBRARY_SUMMARY: 'asset:get-library-summary',
} as const;

export const TASK_IPC_CHANNELS = {
  LIST_TASKS: 'task:list',
  CREATE_TASK: 'task:create',
  GET_TASK_BY_ID: 'task:get-by-id',
  LIST_TASK_ASSETS: 'task:list-assets',
  ATTACH_ASSET: 'task:attach-asset',
  REMOVE_ASSET: 'task:remove-asset',
} as const;

export const MEMORY_IPC_CHANNELS = {
  GET_PROJECT_RESIDENT_MEMORY: 'memory:get-project-resident-memory',
  UPDATE_PROJECT_RESIDENT_MEMORY: 'memory:update-project-resident-memory',
  GET_USER_RESIDENT_MEMORY: 'memory:get-user-resident-memory',
  UPDATE_USER_RESIDENT_MEMORY: 'memory:update-user-resident-memory',
  GET_TASK_PREPARATION_SNAPSHOT: 'memory:get-task-preparation-snapshot',
} as const;

export const SETTINGS_IPC_CHANNELS = {
  GET_SYSTEM_SETTINGS: 'settings:get-system-settings',
  UPDATE_SYSTEM_SETTINGS: 'settings:update-system-settings',
  TEST_SYSTEM_API: 'settings:test-system-api',
  GET_USER_PREFERENCES: 'settings:get-user-preferences',
  UPDATE_USER_PREFERENCES: 'settings:update-user-preferences',
} as const;
