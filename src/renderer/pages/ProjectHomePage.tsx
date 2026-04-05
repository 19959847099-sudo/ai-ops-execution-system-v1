import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ProjectRecord } from '@shared/types/project';

const PLACEHOLDER_SECTIONS = [
  {
    title: '最近任务',
    description: '后续将在这里挂接主链任务列表与最近执行记录。',
    emptyTitle: '最近任务尚未接入',
    emptyMessage: '本阶段只建立项目主页壳层，不读取真实任务数据。',
  },
  {
    title: '最近结果',
    description: '后续将在这里挂接最新产出、候选结果与处理状态。',
    emptyTitle: '最近结果尚未接入',
    emptyMessage: '本阶段不读取真实结果数据，也不进入审核链路。',
  },
  {
    title: '素材概览',
    description: '后续将在这里挂接项目素材统计、入口与最近变更。',
    emptyTitle: '素材概览尚未接入',
    emptyMessage: '本阶段只保留占位区，不接入素材库业务。',
  },
  {
    title: '记忆摘要',
    description: '后续将在这里挂接常驻记忆与项目上下文摘要。',
    emptyTitle: '记忆摘要尚未接入',
    emptyMessage: '本阶段不读取真实记忆数据，也不接入回流逻辑。',
  },
] as const;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatProjectStatus(status: ProjectRecord['status']): string {
  return status === 'active' ? '进行中' : '已归档';
}

export function ProjectHomePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const result = await window.projectApi.getProjectById(projectId);
        if (!disposed) {
          setProject(result);
        }
      } catch (nextError) {
        if (!disposed) {
          setError(nextError instanceof Error ? nextError.message : '项目读取失败。');
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

  const handleTaskEntryClick = () => {
    window.alert('当前未接入任务创建。');
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-3</p>
        <h2>正在读取项目主页壳层...</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-3</p>
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
        <p className="eyebrow">Stage 1-3</p>
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
            <p className="eyebrow">Stage 1-3</p>
            <h2>{project.name}</h2>
            <p className="page-helper">
              当前项目主页只建立基础壳层，用于承接后续任务、结果、素材与记忆模块。
            </p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to="/">
              返回项目列表
            </Link>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/settings`}>
              项目设置
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
            <h3>新建任务入口</h3>
          </div>
          <button type="button" className="primary-button" onClick={handleTaskEntryClick}>
            新建任务
          </button>
        </div>
        <p className="page-helper">
          当前仅保留入口位置。点击后只提示“当前未接入任务创建”，不进入真实任务流程。
        </p>
      </div>

      <div className="project-home-grid">
        {PLACEHOLDER_SECTIONS.map((section) => (
          <section key={section.title} className="page-card feature-card">
            <div className="feature-card__header">
              <div>
                <p className="eyebrow">Placeholder</p>
                <h3>{section.title}</h3>
              </div>
            </div>
            <p className="page-helper">{section.description}</p>
            <div className="empty-state feature-empty-state">
              <h4>{section.emptyTitle}</h4>
              <p>{section.emptyMessage}</p>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
