/// <reference types="vite/client" />

import type { AssetBridgeApi } from '@shared/types/asset';
import type { CoreBridgeApi } from '@shared/types/app';
import type { MemoryBridgeApi } from '@shared/types/memory';
import type { ProjectBridgeApi } from '@shared/types/project';
import type { ResultBridgeApi } from '@shared/types/result';
import type { SettingsBridgeApi } from '@shared/types/settings';
import type { TaskBridgeApi } from '@shared/types/task';

declare global {
  interface Window {
    coreApi: CoreBridgeApi;
    projectApi: ProjectBridgeApi;
    assetApi: AssetBridgeApi;
    taskApi: TaskBridgeApi;
    memoryApi: MemoryBridgeApi;
    resultApi: ResultBridgeApi;
    settingsApi: SettingsBridgeApi;
  }
}

export {};
