import { FormEvent, useEffect, useState } from 'react';
import type {
  EditableSystemSettings,
  SystemApiTestResult,
} from '@shared/types/settings';

const EMPTY_FORM: EditableSystemSettings = {
  providerName: 'qwen',
  apiBaseUrl: '',
  apiKey: '',
  modelName: '',
  appRootPath: '',
  projectRootPath: '',
};

export function ApiSettingsPage() {
  const [form, setForm] = useState<EditableSystemSettings>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<SystemApiTestResult | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadSettings = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await window.settingsApi.getSystemSettings();
        if (!disposed) {
          setForm(result);
        }
      } catch (error) {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : 'API 设置读取失败。');
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      disposed = true;
    };
  }, []);

  const updateField = <K extends keyof EditableSystemSettings>(
    field: K,
    value: EditableSystemSettings[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveSuccess(null);
    setSaveError(null);
    setTestResult(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const updated = await window.settingsApi.updateSystemSettings(form);
      setForm(updated);
      setSaveSuccess('API 设置已保存。');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'API 设置保存失败。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await window.settingsApi.testSystemApi(form);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '连通性测试失败。',
        statusCode: null,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-5</p>
        <h2>正在读取 API 设置...</h2>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-5</p>
        <h2>API 设置读取失败</h2>
        <p className="inline-error">{loadError}</p>
      </section>
    );
  }

  return (
    <section className="page-stack settings-layout">
      <div className="page-card page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 1-5</p>
            <h2>API 设置</h2>
            <p className="page-helper">
              当前只维护固定单 API（千问）系统配置，不进入多 provider、多模型路由或主链调用平台。
            </p>
          </div>
        </div>
      </div>

      <form className="page-stack" onSubmit={handleSave}>
        <section className="page-card settings-section">
          <div className="settings-section__header">
            <div>
              <p className="eyebrow">Provider</p>
              <h3>固定 Provider</h3>
            </div>
            <p className="page-helper">本轮固定使用千问，不提供 provider 切换。</p>
          </div>

          <label className="form-field">
            <span>Provider Name</span>
            <input value={form.providerName} readOnly disabled className="readonly-input" />
          </label>
        </section>

        <section className="page-card settings-section">
          <div className="settings-section__header">
            <div>
              <p className="eyebrow">API Config</p>
              <h3>接口基础配置</h3>
            </div>
            <p className="page-helper">用于后续主链调用的系统级配置入口。</p>
          </div>

          <div className="settings-grid">
            <label className="form-field">
              <span>API Base URL</span>
              <input
                value={form.apiBaseUrl}
                onChange={(event) => updateField('apiBaseUrl', event.target.value)}
                placeholder="输入 API Base URL"
                disabled={isSaving || isTesting}
              />
            </label>

            <label className="form-field">
              <span>Model Name</span>
              <input
                value={form.modelName}
                onChange={(event) => updateField('modelName', event.target.value)}
                placeholder="输入模型名称"
                disabled={isSaving || isTesting}
              />
            </label>

            <label className="form-field settings-grid__full">
              <span>API Key</span>
              <input
                type="password"
                value={form.apiKey}
                onChange={(event) => updateField('apiKey', event.target.value)}
                placeholder="输入 API Key"
                autoComplete="off"
                disabled={isSaving || isTesting}
              />
            </label>
          </div>
        </section>

        <section className="page-card settings-section">
          <div className="settings-section__header">
            <div>
              <p className="eyebrow">Local Paths</p>
              <h3>本地路径配置</h3>
            </div>
            <p className="page-helper">
              当前只维护配置值，不承诺即时迁移已有目录；修改后需由后续阶段决定何时生效。
            </p>
          </div>

          <div className="settings-grid">
            <label className="form-field">
              <span>App Root Path</span>
              <input
                value={form.appRootPath}
                onChange={(event) => updateField('appRootPath', event.target.value)}
                placeholder="输入应用根路径"
                disabled={isSaving || isTesting}
              />
            </label>

            <label className="form-field">
              <span>Project Root Path</span>
              <input
                value={form.projectRootPath}
                onChange={(event) => updateField('projectRootPath', event.target.value)}
                placeholder="输入项目根路径"
                disabled={isSaving || isTesting}
              />
            </label>
          </div>
        </section>

        <section className="page-card settings-section">
          <div className="settings-actions">
            <button className="primary-button" type="submit" disabled={isSaving || isTesting}>
              {isSaving ? '保存中...' : '保存 API 设置'}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void handleTest()}
              disabled={isSaving || isTesting}
            >
              {isTesting ? '测试中...' : '测试连通性'}
            </button>
            {saveSuccess ? <p className="success-text">{saveSuccess}</p> : null}
            {saveError ? <p className="inline-error">{saveError}</p> : null}
            {testResult ? (
              <p className={testResult.success ? 'success-text' : 'inline-error'}>
                {testResult.message}
              </p>
            ) : null}
          </div>
        </section>
      </form>
    </section>
  );
}
