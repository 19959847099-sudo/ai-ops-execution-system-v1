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

export const SETTINGS_IPC_CHANNELS = {
  GET_SYSTEM_SETTINGS: 'settings:get-system-settings',
  UPDATE_SYSTEM_SETTINGS: 'settings:update-system-settings',
  TEST_SYSTEM_API: 'settings:test-system-api',
  GET_USER_PREFERENCES: 'settings:get-user-preferences',
  UPDATE_USER_PREFERENCES: 'settings:update-user-preferences',
} as const;
