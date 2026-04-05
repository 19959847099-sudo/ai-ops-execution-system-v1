/// <reference types="vite/client" />

import type { CoreBridgeApi } from '@shared/types/app';
import type { ProjectBridgeApi } from '@shared/types/project';
import type { SettingsBridgeApi } from '@shared/types/settings';

declare global {
  interface Window {
    coreApi: CoreBridgeApi;
    projectApi: ProjectBridgeApi;
    settingsApi: SettingsBridgeApi;
  }
}

export {};
