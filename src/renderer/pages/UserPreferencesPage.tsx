import { FormEvent, useEffect, useState } from 'react';
import type { EditableResidentUserPreferences } from '@shared/types/settings';

const EMPTY_FORM: EditableResidentUserPreferences = {
  productPreference: '',
  expressionPreference: '',
  designPreference: '',
  developmentPreference: '',
  costPreference: '',
};

export function UserPreferencesPage() {
  const [form, setForm] = useState<EditableResidentUserPreferences>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadPreferences = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await window.settingsApi.getUserPreferences();
        if (!disposed) {
          setForm(result);
        }
      } catch (error) {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : '用户偏好读取失败。');
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      disposed = true;
    };
  }, []);

  const updateField = <K extends keyof EditableResidentUserPreferences>(
    field: K,
    value: EditableResidentUserPreferences[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveSuccess(null);
    setSaveError(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const updated = await window.settingsApi.updateUserPreferences(form);
      setForm(updated);
      setSaveSuccess('用户偏好已保存。');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '用户偏好保存失败。');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-6</p>
        <h2>正在读取用户偏好...</h2>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-6</p>
        <h2>用户偏好读取失败</h2>
        <p className="inline-error">{loadError}</p>
      </section>
    );
  }

  return (
    <section className="page-stack settings-layout">
      <div className="page-card page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 1-6</p>
            <h2>用户偏好设置</h2>
            <p className="page-helper">
              当前只维护用户偏好常驻字段，不进入偏好推荐、提示词控制台或多用户体系。
            </p>
          </div>
        </div>
      </div>

      <form className="page-stack" onSubmit={handleSave}>
        <section className="page-card settings-section">
          <div className="settings-section__header">
            <div>
              <p className="eyebrow">Preferences</p>
              <h3>偏好常驻字段</h3>
            </div>
            <p className="page-helper">这些字段只作为用户层长期偏好配置，不自动推导、不自动总结。</p>
          </div>

          <div className="settings-grid">
            <label className="form-field settings-grid__full">
              <span>产品偏好</span>
              <textarea
                className="form-textarea"
                value={form.productPreference}
                onChange={(event) => updateField('productPreference', event.target.value)}
                placeholder="记录你对产品方向、产品风格或功能取舍的稳定偏好"
                rows={4}
                disabled={isSaving}
              />
            </label>

            <label className="form-field settings-grid__full">
              <span>表达偏好</span>
              <textarea
                className="form-textarea"
                value={form.expressionPreference}
                onChange={(event) => updateField('expressionPreference', event.target.value)}
                placeholder="记录你偏好的表达方式、语气风格与内容组织习惯"
                rows={4}
                disabled={isSaving}
              />
            </label>

            <label className="form-field settings-grid__full">
              <span>设计偏好</span>
              <textarea
                className="form-textarea"
                value={form.designPreference}
                onChange={(event) => updateField('designPreference', event.target.value)}
                placeholder="记录你偏好的视觉风格、布局倾向与界面取舍"
                rows={4}
                disabled={isSaving}
              />
            </label>

            <label className="form-field settings-grid__full">
              <span>开发偏好</span>
              <textarea
                className="form-textarea"
                value={form.developmentPreference}
                onChange={(event) => updateField('developmentPreference', event.target.value)}
                placeholder="记录你偏好的工程方式、代码风格与实施取向"
                rows={4}
                disabled={isSaving}
              />
            </label>

            <label className="form-field settings-grid__full">
              <span>成本偏好</span>
              <textarea
                className="form-textarea"
                value={form.costPreference}
                onChange={(event) => updateField('costPreference', event.target.value)}
                placeholder="记录你对预算、成本控制和投入产出平衡的偏好"
                rows={4}
                disabled={isSaving}
              />
            </label>
          </div>
        </section>

        <section className="page-card settings-section">
          <div className="settings-actions">
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? '保存中...' : '保存用户偏好'}
            </button>
            {saveSuccess ? <p className="success-text">{saveSuccess}</p> : null}
            {saveError ? <p className="inline-error">{saveError}</p> : null}
          </div>
        </section>
      </form>
    </section>
  );
}
