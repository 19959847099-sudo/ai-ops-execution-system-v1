import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ProjectRecord, UpdateProjectSettingsInput } from '@shared/types/project';

type FormState = UpdateProjectSettingsInput;

const EMPTY_FORM: FormState = {
  name: '',
  oneLineDefinition: '',
  targetAudience: '',
  coreValue: '',
  currentFocus: '',
  forbiddenExpressions: '',
  fixedConstraints: '',
};

function toFormState(project: ProjectRecord): FormState {
  return {
    name: project.name,
    oneLineDefinition: project.oneLineDefinition ?? '',
    targetAudience: project.targetAudience ?? '',
    coreValue: project.coreValue ?? '',
    currentFocus: project.currentFocus ?? '',
    forbiddenExpressions: project.forbiddenExpressions ?? '',
    fixedConstraints: project.fixedConstraints ?? '',
  };
}

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadProject = async () => {
      if (!projectId) {
        setProject(null);
        setIsLoading(false);
        setLoadError(null);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await window.projectApi.getProjectById(projectId);
        if (!disposed) {
          setProject(result);
          setForm(result ? toFormState(result) : EMPTY_FORM);
        }
      } catch (error) {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : '项目设置读取失败。');
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    void loadProject();

    return () => {
      disposed = true;
    };
  }, [projectId]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveSuccess(null);
    setSaveError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectId) {
      setSaveError('项目不存在。');
      return;
    }

    if (!form.name.trim()) {
      setSaveError('项目名称不能为空。');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const updated = await window.projectApi.updateProjectSettings(projectId, form);
      setProject(updated);
      setForm(toFormState(updated));
      setSaveSuccess('项目设置已保存。');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '项目设置保存失败。');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-4</p>
        <h2>正在读取项目设置...</h2>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-4</p>
        <h2>项目设置读取失败</h2>
        <p className="inline-error">{loadError}</p>
        <div className="page-actions">
          <Link className="ghost-button link-button" to="/">
            返回项目列表
          </Link>
        </div>
      </section>
    );
  }

  if (!projectId || !project) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-4</p>
        <h2>项目不存在</h2>
        <p className="muted-text">未找到项目，请返回项目主页或项目列表重新选择。</p>
        <div className="page-actions">
          {projectId ? (
            <Link className="ghost-button link-button" to={`/projects/${projectId}`}>
              返回项目主页
            </Link>
          ) : null}
          <Link className="ghost-button link-button" to="/">
            返回项目列表
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack settings-layout">
      <div className="page-card page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 1-4</p>
            <h2>项目设置</h2>
            <p className="page-helper">
              当前只维护项目基础信息与项目常驻记忆基础字段，不进入完整记忆系统。
            </p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to={`/projects/${project.id}`}>
              返回项目主页
            </Link>
            <span className={project.status === 'active' ? 'status-chip is-active' : 'status-chip'}>
              {project.status === 'active' ? '进行中' : '已归档'}
            </span>
          </div>
        </div>
      </div>

      <form className="page-stack" onSubmit={handleSubmit}>
        <section className="page-card settings-section">
          <div className="settings-section__header">
            <div>
              <p className="eyebrow">Project Basics</p>
              <h3>{project.name}</h3>
            </div>
            <p className="page-helper">项目名称会同步影响项目主页与项目列表展示。</p>
          </div>

          <label className="form-field">
            <span>项目名称</span>
            <input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="输入项目名称"
              maxLength={80}
              disabled={isSaving}
            />
          </label>
        </section>

        <section className="page-card settings-section">
          <div className="settings-section__header">
            <div>
              <p className="eyebrow">Resident Memory</p>
              <h3>项目常驻记忆基础字段</h3>
            </div>
            <p className="page-helper">本轮只维护固定配置字段，不进入长期记忆系统。</p>
          </div>

          <div className="settings-grid">
            <label className="form-field">
              <span>一句话定义</span>
              <textarea
                className="form-textarea"
                value={form.oneLineDefinition}
                onChange={(event) => updateField('oneLineDefinition', event.target.value)}
                placeholder="用一句话定义这个项目要做什么"
                rows={3}
                disabled={isSaving}
              />
            </label>

            <label className="form-field">
              <span>目标用户</span>
              <textarea
                className="form-textarea"
                value={form.targetAudience}
                onChange={(event) => updateField('targetAudience', event.target.value)}
                placeholder="这个项目主要服务哪些人"
                rows={3}
                disabled={isSaving}
              />
            </label>

            <label className="form-field">
              <span>核心价值</span>
              <textarea
                className="form-textarea"
                value={form.coreValue}
                onChange={(event) => updateField('coreValue', event.target.value)}
                placeholder="项目最核心的价值主张是什么"
                rows={3}
                disabled={isSaving}
              />
            </label>

            <label className="form-field">
              <span>当前重点</span>
              <textarea
                className="form-textarea"
                value={form.currentFocus}
                onChange={(event) => updateField('currentFocus', event.target.value)}
                placeholder="当前阶段最需要聚焦的重点"
                rows={3}
                disabled={isSaving}
              />
            </label>

            <label className="form-field">
              <span>禁止表达</span>
              <textarea
                className="form-textarea"
                value={form.forbiddenExpressions}
                onChange={(event) => updateField('forbiddenExpressions', event.target.value)}
                placeholder="明确不希望出现的表达、语气或内容"
                rows={4}
                disabled={isSaving}
              />
            </label>

            <label className="form-field">
              <span>固定约束</span>
              <textarea
                className="form-textarea"
                value={form.fixedConstraints}
                onChange={(event) => updateField('fixedConstraints', event.target.value)}
                placeholder="固定要求、硬约束或不可突破的边界"
                rows={4}
                disabled={isSaving}
              />
            </label>
          </div>
        </section>

        <section className="page-card settings-section">
          <div className="settings-actions">
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? '保存中...' : '保存项目设置'}
            </button>
            {saveSuccess ? <p className="success-text">{saveSuccess}</p> : null}
            {saveError ? <p className="inline-error">{saveError}</p> : null}
          </div>
        </section>
      </form>
    </section>
  );
}
