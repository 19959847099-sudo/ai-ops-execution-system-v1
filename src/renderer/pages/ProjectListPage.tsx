import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectListFilter, ProjectRecord } from '@shared/types/project';

const FILTER_LABELS: Array<{ value: Exclude<ProjectListFilter, 'all'>; label: string }> = [
  { value: 'active', label: '进行中项目' },
  { value: 'archived', label: '已归档项目' },
];

function formatDate(value: string | null): string {
  if (!value) {
    return '未记录';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ProjectListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Exclude<ProjectListFilter, 'all'>>('active');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);

  const loadProjects = async (nextFilter: Exclude<ProjectListFilter, 'all'>) => {
    setIsLoading(true);
    setListError(null);

    try {
      const result = await window.projectApi.listProjects(nextFilter);
      setProjects(result);
    } catch (error) {
      setListError(error instanceof Error ? error.message : '项目列表读取失败。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects(filter);
  }, [filter]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();

    if (!name) {
      setCreateError('项目名称不能为空。');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      await window.projectApi.createProject({ name });
      setProjectName('');
      setFilter('active');
      await loadProjects('active');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '项目创建失败。');
    } finally {
      setIsCreating(false);
    }
  };

  const handleArchive = async (project: ProjectRecord) => {
    const confirmed = window.confirm(`确认归档项目“${project.name}”吗？`);
    if (!confirmed) {
      return;
    }

    setArchivingProjectId(project.id);
    setListError(null);

    try {
      await window.projectApi.archiveProject(project.id);
      await loadProjects(filter);
    } catch (error) {
      setListError(error instanceof Error ? error.message : '项目归档失败。');
    } finally {
      setArchivingProjectId(null);
    }
  };

  const isArchivedView = filter === 'archived';

  return (
    <section className="page-card page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Stage 1-2</p>
          <h2>项目列表与创建归档</h2>
        </div>
        <p className="page-helper">
          当前只接入项目创建、列表展示、进入项目和软归档，不包含项目主页聚合与设置业务。
        </p>
      </div>

      <form className="project-create-form" onSubmit={handleCreate}>
        <label className="form-field">
          <span>新建项目</span>
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="输入项目名称"
            maxLength={80}
            disabled={isCreating}
          />
        </label>
        <button className="primary-button" type="submit" disabled={isCreating}>
          {isCreating ? '创建中...' : '创建项目'}
        </button>
      </form>

      {createError ? <p className="inline-error">{createError}</p> : null}

      <div className="segmented-control" role="tablist" aria-label="项目状态切换">
        {FILTER_LABELS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? 'segment is-active' : 'segment'}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {listError ? <p className="inline-error">{listError}</p> : null}

      {isLoading ? <p className="muted-text">正在读取项目列表...</p> : null}

      {!isLoading && projects.length === 0 ? (
        <div className="empty-state">
          <h3>{isArchivedView ? '还没有已归档项目' : '还没有项目'}</h3>
          <p>{isArchivedView ? '当前没有已归档项目，可切回进行中查看。' : '先创建一个项目，作为后续运营执行容器入口。'}</p>
        </div>
      ) : null}

      {!isLoading && projects.length > 0 ? (
        <div className="project-list">
          {projects.map((project) => (
            <article key={project.id} className="project-item">
              <div className="project-item__main">
                <div className="project-item__title-row">
                  <h3>{project.name}</h3>
                  <span className={project.status === 'active' ? 'status-chip is-active' : 'status-chip'}>
                    {project.status === 'active' ? '进行中' : '已归档'}
                  </span>
                </div>
                <ul className="project-meta">
                  <li>创建时间：{formatDate(project.createdAt)}</li>
                  {project.archivedAt ? <li>归档时间：{formatDate(project.archivedAt)}</li> : null}
                </ul>
              </div>

              <div className="project-item__actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  进入项目
                </button>
                {project.status === 'active' ? (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void handleArchive(project)}
                    disabled={archivingProjectId === project.id}
                  >
                    {archivingProjectId === project.id ? '归档中...' : '归档'}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
