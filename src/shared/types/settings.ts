export type ProviderName = 'qwen';

export type SystemSettingKey =
  | 'providerName'
  | 'apiBaseUrl'
  | 'apiKey'
  | 'modelName'
  | 'appRootPath'
  | 'projectRootPath';

export type SystemSettings = {
  providerName: ProviderName;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  appRootPath: string;
  projectRootPath: string;
};

export type EditableSystemSettings = SystemSettings;

export type BootstrapSystemSettings = Pick<SystemSettings, 'providerName'>;

export type ResidentUserPreferences = {
  language: string;
  navigationCollapsed: boolean;
};

export type SystemApiTestResult = {
  success: boolean;
  message: string;
  statusCode: number | null;
};

export type SettingsBridgeApi = {
  getSystemSettings: () => Promise<EditableSystemSettings>;
  updateSystemSettings: (input: EditableSystemSettings) => Promise<EditableSystemSettings>;
  testSystemApi: (input: EditableSystemSettings) => Promise<SystemApiTestResult>;
};
