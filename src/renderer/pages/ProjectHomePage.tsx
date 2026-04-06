import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AssetLibrarySummary } from '@shared/types/asset';
import type { ProjectRecord } from '@shared/types/project';
import type { CreateTaskInput, TaskForm, TaskRecord, TaskStatus } from '@shared/types/task';

const EMPTY_SUMMARY: AssetLibrarySummary = {
  totalCount: 0,
  imageCount: 0,
  videoCount: 0,
  textCount: 0,
  lastImportedAt: null,
};

const EMPTY_TASK_FORM: CreateTaskInput = {
  title: '',
  goal: '',
  taskForm: 'article',
  supplementalRequirements: '',
};

function formatDate(value: string | null): string {
  if (!value) {
    return '暂无';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatProjectStatus(status: ProjectRecord['status']): string {
  return status === 'active' ? '进行中' : '已归档';
}

function formatTaskStatus(status: TaskStatus): string {
  if (status === 'generating') {
    return '生成中';
  }

  if (status === 'ready') {
    return '已产出候选';
  }

  if (status === 'failed') {
    return '生成失败';
  }

  return '待生成';
}

function formatTaskForm(taskForm: TaskForm): string {
  return taskForm === 'article' ? '图文' : '视频';
}

export function ProjectHomePage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [assetSummary, setAssetSummary] = useState<AssetLibrarySummary>(EMPTY_SUMMARY);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [form, setForm] = useState<CreateTaskInput>(EMPTY_TASK_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const recentTasks = useMemo(() => tasks.slice(0, 3), [tasks]);

  useEffect(() => {
    let disposed = false;

    const loadProject = async () => {
      if (!projectId) {
        setProject(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [projectRecord, summary, taskRecords] = await Promise.all([
          window.projectApi.getProjectById(projectId),
          window.assetApi.getAssetLibrarySummary(projectId),
          window.taskApi.listTasks(projectId),
        ]);

        if (!disposed) {
          setProject(projectRecord);
          setAssetSummary(summary);
          setTasks(taskRecords);
        }
      } catch (nextError) {
        if (!disposed) {
          setError(nextError instanceof Error ? nextError.message : '项目主页读取失败。');
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

  const updateField = <K extends keyof CreateTaskInput>(field: K, value: CreateTaskInput[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setCreateError(null);
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId) {
      return;
    }

    setIsCreatingTask(true);
    setCreateError(null);

    try {
      const created = await window.taskApi.createTask(projectId, form);
      navigate(`/projects/${projectId}/tasks?taskId=${created.id}`);
    } catch (nextError) {
      setCreateError(nextError instanceof Error ? nextError.message : '任务发起失败。');
    } finally {
      setIsCreatingTask(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 4-1</p>
        <h2>正在读取项目主页...</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 4-1</p>
        <h2>项目读取失败</h2>
        <p className="inline-error">{error}</p>
        <Link className="ghost-button link-button" to="/">
          返回项目列表
        </Link>
      </section>
    );
  }

  if (!projectId || !project) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 4-1</p>
        <h2>项目不存在</h2>
        <p>未找到项目，请返回项目列表重新选择。</p>
        <Link className="ghost-button link-button" to="/">
          返回项目列表
        </Link>
      </section>
    );
  }

  return (
    <section className="page-stack project-home-shell">
      <div className="page-card project-home-hero">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 4-1</p>
            <h2>{project.name}</h2>
            <p className="page-helper">
              项目主页在阶段 4 正式承担主链入口，只负责发起任务并进入候选生成承接，不扩展成结果层或审核页。
            </p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to="/">
              返回项目列表
            </Link>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/settings`}>
              项目设置
            </Link>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/results`}>
              缁撴灉鍥炵湅
            </Link>
            <span className={project.status === 'active' ? 'status-chip is-active' : 'status-chip'}>
              {formatProjectStatus(project.status)}
            </span>
          </div>
        </div>

        <div className="project-identity-grid">
          <div className="identity-item">
            <span className="identity-item__label">项目 ID</span>
            <span className="identity-item__value">{project.id}</span>
          </div>
          <div className="identity-item">
            <span className="identity-item__label">创建时间</span>
            <span className="identity-item__value">{formatDate(project.createdAt)}</span>
          </div>
          <div className="identity-item">
            <span className="identity-item__label">更新时间</span>
            <span className="identity-item__value">{formatDate(project.updatedAt)}</span>
          </div>
          {project.archivedAt ? (
            <div className="identity-item">
              <span className="identity-item__label">归档时间</span>
              <span className="identity-item__value">{formatDate(project.archivedAt)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="page-card feature-card feature-card--primary">
        <div className="feature-card__header">
          <div>
            <p className="eyebrow">Task Entry</p>
            <h3>发起主链任务</h3>
          </div>
          <Link className="ghost-button link-button" to={`/projects/${project.id}/tasks`}>
            进入任务承接页
          </Link>
        </div>

        <p className="page-helper">
          任务发起卡固定只收集主题、目标、形式与补充要求；生成候选后仍停留在当前任务维度，不进入项目级结果层。
        </p>

        <form className="page-stack task-launch-form" onSubmit={handleCreateTask}>
          <div className="settings-grid">
            <label className="form-field">
              <span>主题</span>
              <input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="例如：私域增长复盘"
                maxLength={120}
                disabled={isCreatingTask}
              />
            </label>

            <label className="form-field">
              <span>目标</span>
              <input
                value={form.goal}
                onChange={(event) => updateField('goal', event.target.value)}
                placeholder="例如：生成 3 个可直接评估的候选"
                maxLength={240}
                disabled={isCreatingTask}
              />
            </label>

            <label className="form-field">
              <span>形式</span>
              <select
                className="form-select"
                value={form.taskForm}
                onChange={(event) => updateField('taskForm', event.target.value as TaskForm)}
                disabled={isCreatingTask}
              >
                <option value="article">图文</option>
                <option value="video">视频</option>
              </select>
            </label>

            <label className="form-field settings-grid__full">
              <span>补充要求</span>
              <textarea
                className="form-textarea"
                value={form.supplementalRequirements}
                onChange={(event) => updateField('supplementalRequirements', event.target.value)}
                placeholder="例如：避免夸张表达，突出转化动作。"
                maxLength={1000}
                disabled={isCreatingTask}
              />
            </label>
          </div>

          {createError ? <p className="inline-error">{createError}</p> : null}

          <div className="settings-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={isCreatingTask || !form.title.trim() || !form.goal.trim()}
            >
              {isCreatingTask ? '任务发起中...' : '发起任务并进入候选生成'}
            </button>
          </div>
        </form>
      </div>

      <div className="project-home-grid">
        <section className="page-card feature-card">
          <div className="feature-card__header">
            <div>
              <p className="eyebrow">Task Overview</p>
              <h3>最近任务</h3>
            </div>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/tasks`}>
              打开任务承接页
            </Link>
          </div>
          <p className="page-helper">阶段 4 只承接任务发起与候选生成，不延展为项目级结果列表。</p>

          {recentTasks.length === 0 ? (
            <div className="empty-state feature-empty-state">
              <h4>当前还没有任务</h4>
              <p>先在上方任务发起卡创建任务，再进入任务承接页生成候选。</p>
            </div>
          ) : (
            <div className="task-list">
              {recentTasks.map((task) => (
                <Link
                  key={task.id}
                  className="task-item"
                  to={`/projects/${project.id}/tasks?taskId=${task.id}`}
                >
                  <strong>{task.title}</strong>
                  <p className="muted-text">目标：{task.goal}</p>
                  <p className="muted-text">
                    {formatTaskForm(task.taskForm)} · {formatTaskStatus(task.status)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="page-card feature-card">
          <div className="feature-card__header">
            <div>
              <p className="eyebrow">Stage 2</p>
              <h3>素材概览</h3>
            </div>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/assets`}>
              进入素材库
            </Link>
          </div>
          <p className="page-helper">阶段 4 直接复用阶段 2 的素材库与任务素材挂接结果作为主链输入。</p>
          <div className="asset-summary-grid">
            <article className="summary-card">
              <span className="summary-card__label">总数</span>
              <strong>{assetSummary.totalCount}</strong>
            </article>
            <article className="summary-card">
              <span className="summary-card__label">图片</span>
              <strong>{assetSummary.imageCount}</strong>
            </article>
            <article className="summary-card">
              <span className="summary-card__label">视频</span>
              <strong>{assetSummary.videoCount}</strong>
            </article>
            <article className="summary-card">
              <span className="summary-card__label">文本</span>
              <strong>{assetSummary.textCount}</strong>
            </article>
          </div>
          <p className="muted-text">最近导入：{formatDate(assetSummary.lastImportedAt)}</p>
          <div className="page-actions">
            <Link className="ghost-button link-button" to={`/projects/${project.id}/assets`}>
              打开素材库
            </Link>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/tasks`}>
              进入任务承接页
            </Link>
          </div>
        </section>

        <section className="page-card feature-card">
          <div className="feature-card__header">
            <div>
              <p className="eyebrow">Stage 3</p>
              <h3>常驻记忆已就绪</h3>
            </div>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/settings`}>
              查看项目常驻记忆
            </Link>
          </div>
          <p className="page-helper">
            阶段 4 会优先复用阶段 3 已形成的任务前常驻记忆快照，不在主链里重新分散读取并重复拼接记忆。
          </p>
          <div className="empty-state feature-empty-state">
            <h4>当前只做读取前置</h4>
            <p>项目常驻记忆和用户偏好常驻记忆将在任务承接页中被统一读取，但不进入临时记忆、回流或压缩逻辑。</p>
          </div>
        </section>
      </div>
    </section>
  );
}
