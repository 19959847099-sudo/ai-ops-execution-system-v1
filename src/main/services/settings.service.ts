import type Database from 'better-sqlite3';
import {
  residentUserPreferencesSchema,
  systemSettingsSchema,
} from '../../shared/schema/settings';
import type {
  BootstrapSystemSettings,
  EditableSystemSettings,
  ResidentUserPreferences,
  SystemApiTestResult,
  SystemSettingKey,
  SystemSettings,
} from '../../shared/types/settings';
import type { AppPaths } from '../../shared/types/app';

type SettingsRow = { key: SystemSettingKey; value: string };
type PreferenceRow = { key: keyof ResidentUserPreferences; value: string };

export class SettingsService {
  constructor(
    private readonly db: Database.Database,
    private readonly paths: AppPaths,
  ) {}

  ensureDefaults(): void {
    const now = new Date().toISOString();
    const defaults: SystemSettings = {
      providerName: 'qwen',
      apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: '',
      modelName: 'qwen-max',
      appRootPath: this.paths.appDataDir,
      projectRootPath: this.paths.projectRootDir,
    };

    const preferenceDefaults: ResidentUserPreferences = {
      language: 'zh-CN',
      navigationCollapsed: false,
    };

    const insertSettingIfMissing = this.db.prepare(`
      INSERT OR IGNORE INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    const insertPreference = this.db.prepare(`
      INSERT OR IGNORE INTO resident_user_preferences (key, value, updated_at)
      VALUES (?, ?, ?)
    `);

    for (const [key, value] of Object.entries(defaults) as Array<[SystemSettingKey, string]>) {
      insertSettingIfMissing.run(key, JSON.stringify(value), now);
    }

    for (const [key, value] of Object.entries(preferenceDefaults) as Array<
      [keyof ResidentUserPreferences, ResidentUserPreferences[keyof ResidentUserPreferences]]
    >) {
      insertPreference.run(key, JSON.stringify(value), now);
    }
  }

  getSystemSettings(): SystemSettings {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as SettingsRow[];
    const candidate = rows.reduce<Partial<SystemSettings>>((result, row) => {
      result[row.key] = JSON.parse(row.value) as never;
      return result;
    }, {});

    return systemSettingsSchema.parse(candidate);
  }

  getEditableSystemSettings(): EditableSystemSettings {
    return this.getSystemSettings();
  }

  updateSystemSettings(input: EditableSystemSettings): EditableSystemSettings {
    const settings = this.normalizeSystemSettings(input);
    const now = new Date().toISOString();
    const upsert = this.db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    const applyUpdate = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings) as Array<[SystemSettingKey, string]>) {
        upsert.run(key, JSON.stringify(value), now);
      }
    });

    applyUpdate();
    return this.getEditableSystemSettings();
  }

  async testCurrentSystemSettings(input: EditableSystemSettings): Promise<SystemApiTestResult> {
    const settings = this.normalizeSystemSettings(input);

    if (!settings.apiKey) {
      return {
        success: false,
        message: 'API Key 不能为空。',
        statusCode: null,
      };
    }

    if (!settings.apiBaseUrl) {
      return {
        success: false,
        message: 'API Base URL 不能为空。',
        statusCode: null,
      };
    }

    if (!settings.modelName) {
      return {
        success: false,
        message: '模型名称不能为空。',
        statusCode: null,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const endpoint = `${settings.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: [{ role: 'user', content: 'ping' }],
          temperature: 0,
          max_tokens: 1,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorMessage = await this.readErrorMessage(response);
        return {
          success: false,
          message: errorMessage,
          statusCode: response.status,
        };
      }

      return {
        success: true,
        message: '连通成功。',
        statusCode: response.status,
      };
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? '测试超时，请检查网络或接口配置。'
          : error instanceof Error
            ? error.message
            : '测试失败，请检查当前配置。';

      return {
        success: false,
        message,
        statusCode: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  getBootstrapSystemSettings(): BootstrapSystemSettings {
    const { providerName } = this.getSystemSettings();

    return {
      providerName,
    };
  }

  getResidentUserPreferences(): ResidentUserPreferences {
    const rows = this.db
      .prepare('SELECT key, value FROM resident_user_preferences')
      .all() as PreferenceRow[];

    const candidate = rows.reduce<Partial<ResidentUserPreferences>>((result, row) => {
      result[row.key] = JSON.parse(row.value) as never;
      return result;
    }, {});

    return residentUserPreferencesSchema.parse(candidate);
  }

  private normalizeSystemSettings(input: EditableSystemSettings): EditableSystemSettings {
    return systemSettingsSchema.parse({
      providerName: 'qwen',
      apiBaseUrl: input.apiBaseUrl.trim(),
      apiKey: input.apiKey.trim(),
      modelName: input.modelName.trim(),
      appRootPath: input.appRootPath.trim(),
      projectRootPath: input.projectRootPath.trim(),
    });
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      const message = payload.error?.message || payload.message;

      if (message) {
        return message;
      }
    } catch {
      const fallback = await response.text().catch(() => '');
      if (fallback) {
        return fallback.slice(0, 200);
      }
    }

    return `连通失败（HTTP ${response.status}）。`;
  }
}
