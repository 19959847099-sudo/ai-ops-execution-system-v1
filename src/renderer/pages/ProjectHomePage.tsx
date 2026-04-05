import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AssetLibrarySummary } from '@shared/types/asset';
import type { ProjectRecord } from '@shared/types/project';

const PLACEHOLDER_SECTIONS = [
  {
    title: '最近任务',
    description: '后续将在这里挂接主链任务列表与最近执行记录。',
    emptyTitle: '最近任务尚未接入',
    emptyMessage: '当前阶段只保留任务承接壳，不进入真实任务主链数据。',
  },
  {
    title: '最近结果',
    description: '后续将在这里挂接最新产出、候选结果与处理状态。',
    emptyTitle: '最近结果尚未接入',
    emptyMessage: '当前阶段不读取真实结果数据，也不进入审核链路。',
  },
  {
    title: '记忆摘要',
    description: '后续将在这里挂接常驻记忆与项目上下文摘要。',
    emptyTitle: '记忆摘要尚未接入',
    emptyMessage: '当前阶段不读取真实记忆数据，也不接入回流逻辑。',
  },
] as const;

const EMPTY_SUMMARY: AssetLibrarySummary = {
  totalCount: 0,
  imageCount: 0,
  videoCount: 0,
  textCount: 0,
  lastImportedAt: null,
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

export function ProjectHomePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [assetSummary, setAssetSummary] = useState<AssetLibrarySummary>(EMPTY_SUMMARY);
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
        const [projectRecord, summary] = await Promise.all([
          window.projectApi.getProjectById(projectId),
          window.assetApi.getAssetLibrarySummary(projectId),
        ]);

        if (!disposed) {
          setProject(projectRecord);
          setAssetSummary(summary);
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
    window.alert('当前未接入任务创建主链，请使用阶段 2 的任务素材面板。');
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 1-3</p>
        <h2>正在读取项目主页...</h2>
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
              当前项目主页继续作为入口壳，阶段 2 已把素材概览接成素材库入口。
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
          当前仍不进入任务创建主链；阶段 2 只提供任务素材面板最小承接能力。
        </p>
      </div>

      <div className="project-home-grid">
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
          <p className="page-helper">阶段 2 已接入本地素材库 MVP，可导入、查看、搜索、筛选并加入任务。</p>
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
              任务素材面板
            </Link>
          </div>
        </section>

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
