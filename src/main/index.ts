import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppPathService } from './services/app-path.service';
import { FsService } from './services/fs.service';
import { DbService } from './services/db.service';
import { SettingsService } from './services/settings.service';
import { ProjectService } from './services/project.service';
import { AssetStorageService } from './services/asset-storage.service';
import { AssetService } from './services/asset.service';
import { TaskService } from './services/task.service';
import { TaskAssetService } from './services/task-asset.service';
import { MemoryService } from './services/memory.service';
import { registerCoreIpc } from './ipc/register-core-ipc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

let mainWindow: BrowserWindow | null = null;

async function bootstrapApplication(): Promise<void> {
  const pathService = new AppPathService(app.getPath('userData'));
  const paths = pathService.getPaths();
  const fsService = new FsService();
  fsService.ensureBaseStructure(paths);

  const dbService = new DbService(paths.databasePath);
  const db = dbService.initialize();
  const settingsService = new SettingsService(db, paths);
  const projectService = new ProjectService(db);
  const assetStorageService = new AssetStorageService(paths, fsService);
  const assetService = new AssetService(db, projectService, assetStorageService);
  const taskService = new TaskService(db, projectService);
  const taskAssetService = new TaskAssetService(db, taskService, assetService);
  const memoryService = new MemoryService(projectService, settingsService, taskService);
  settingsService.ensureDefaults();

  registerCoreIpc({
    dbService,
    settingsService,
    projectService,
    assetService,
    taskService,
    taskAssetService,
    memoryService,
    paths,
    appVersion: app.getVersion(),
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1100,
    minHeight: 720,
    title: 'AI 运营执行系统 V1',
    webPreferences: {
      preload: path.join(__dirname, 'index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.whenReady().then(async () => {
  await bootstrapApplication();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    mainWindow = null;
  }
});
