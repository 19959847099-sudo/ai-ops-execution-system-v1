import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AssetFilterType, AssetLibrarySummary, AssetRecord } from '@shared/types/asset';
import type { ProjectRecord } from '@shared/types/project';
import type { TaskRecord } from '@shared/types/task';

const FILTER_OPTIONS: Array<{ value: AssetFilterType; label: string }> = [
  { value: 'all', label: '全部素材' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'text', label: '文本' },
];

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

function formatFileSize(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetLibraryPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [summary, setSummary] = useState<AssetLibrarySummary>(EMPTY_SUMMARY);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [filterType, setFilterType] = useState<AssetFilterType>('all');
  const [textName, setTextName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingText, setIsCreatingText] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const selectedAsset = useMemo(
    () => assets.find((item) => item.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const loadPageData = async (targetProjectId: string, queryKeyword: string, queryType: AssetFilterType) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [projectRecord, assetRecords, taskRecords, assetSummary] = await Promise.all([
        window.projectApi.getProjectById(targetProjectId),
        window.assetApi.listAssets(targetProjectId, { keyword: queryKeyword, type: queryType }),
        window.taskApi.listTasks(targetProjectId),
        window.assetApi.getAssetLibrarySummary(targetProjectId),
      ]);

      setProject(projectRecord);
      setAssets(assetRecords);
      setTasks(taskRecords);
      setSummary(assetSummary);

      if (taskRecords.length > 0) {
        setSelectedTaskId((current) =>
          current && taskRecords.some((task) => task.id === current) ? current : taskRecords[0].id,
        );
      } else {
        setSelectedTaskId('');
      }

      setSelectedAssetId((current) =>
        current && assetRecords.some((asset) => asset.id === current)
          ? current
          : assetRecords[0]?.id ?? null,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '素材库读取失败。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      setProject(null);
      return;
    }

    void loadPageData(projectId, keyword, filterType);
  }, [filterType, keyword, projectId]);

  const handleImport = async () => {
    if (!projectId) {
      return;
    }

    setIsImporting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const imported = await window.assetApi.importAssets(projectId);
      setActionSuccess(imported.length === 0 ? '未选择素材文件，本次未导入。' : `已导入 ${imported.length} 个素材。`);
      await loadPageData(projectId, keyword, filterType);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材导入失败。');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateTextAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId) {
      return;
    }

    setIsCreatingText(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await window.assetApi.createTextAsset(projectId, {
        displayName: textName,
        textContent,
      });
      setTextName('');
      setTextContent('');
      setActionSuccess('文本素材已创建。');
      await loadPageData(projectId, keyword, filterType);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '文本素材创建失败。');
    } finally {
      setIsCreatingText(false);
    }
  };

  const handleAttachAsset = async () => {
    if (!selectedAsset || !selectedTaskId) {
      setActionError('请先选择素材和任务。');
      return;
    }

    setIsAttaching(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await window.taskApi.attachAsset(selectedTaskId, selectedAsset.id);
      setActionSuccess('素材已加入任务。');
      if (projectId) {
        await loadPageData(projectId, keyword, filterType);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材加入任务失败。');
    } finally {
      setIsAttaching(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 2-1</p>
        <h2>正在读取素材库...</h2>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 2-1</p>
        <h2>素材库读取失败</h2>
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
        <p className="eyebrow">Stage 2-1</p>
        <h2>项目不存在</h2>
        <p className="muted-text">未找到项目，请返回项目列表重新选择。</p>
        <div className="page-actions">
          <Link className="ghost-button link-button" to="/">
            返回项目列表
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack asset-library-layout">
      <div className="page-card page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 2-1</p>
            <h2>素材库</h2>
            <p className="page-helper">
              在当前项目下管理本地图片、视频与文本素材，并把素材手动加入任务承接壳。
            </p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to={`/projects/${project.id}`}>
              返回项目主页
            </Link>
            <button className="primary-button" type="button" onClick={handleImport} disabled={isImporting}>
              {isImporting ? '导入中...' : '导入图片 / 视频'}
            </button>
          </div>
        </div>

        <div className="asset-summary-grid">
          <article className="summary-card">
            <span className="summary-card__label">素材总数</span>
            <strong>{summary.totalCount}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-card__label">图片</span>
            <strong>{summary.imageCount}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-card__label">视频</span>
            <strong>{summary.videoCount}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-card__label">文本</span>
            <strong>{summary.textCount}</strong>
          </article>
        </div>

        <p className="muted-text">最近导入时间：{formatDate(summary.lastImportedAt)}</p>
      </div>

      <div className="asset-library-grid">
        <div className="page-stack">
          <section className="page-card page-stack">
            <div className="page-heading">
              <div>
                <p className="eyebrow">Filters</p>
                <h3>搜索与筛选</h3>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => navigate(`/projects/${project.id}/tasks`)}
              >
                进入任务素材面板
              </button>
            </div>

            <div className="settings-grid">
              <label className="form-field">
                <span>关键词</span>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="按名称或文本内容搜索"
                />
              </label>

              <label className="form-field">
                <span>类型筛选</span>
                <select
                  className="form-select"
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value as AssetFilterType)}
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Text Asset</p>
                <h3>创建文本素材</h3>
              </div>
              <p className="page-helper">文本素材会写入项目素材目录，并同步写入基础索引。</p>
            </div>

            <form className="page-stack" onSubmit={handleCreateTextAsset}>
              <label className="form-field">
                <span>素材名称</span>
                <input
                  value={textName}
                  onChange={(event) => setTextName(event.target.value)}
                  placeholder="输入文本素材名称"
                  maxLength={120}
                  disabled={isCreatingText}
                />
              </label>

              <label className="form-field settings-grid__full">
                <span>文本内容</span>
                <textarea
                  className="form-textarea"
                  value={textContent}
                  onChange={(event) => setTextContent(event.target.value)}
                  placeholder="输入需要保存的文本内容"
                  rows={6}
                  disabled={isCreatingText}
                />
              </label>

              <div className="settings-actions">
                <button className="primary-button" type="submit" disabled={isCreatingText}>
                  {isCreatingText ? '创建中...' : '创建文本素材'}
                </button>
              </div>
            </form>
          </section>

          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Assets</p>
                <h3>素材列表</h3>
              </div>
              <p className="page-helper">当前只提供本地索引级搜索与固定类型筛选。</p>
            </div>

            {actionSuccess ? <p className="success-text">{actionSuccess}</p> : null}
            {actionError ? <p className="inline-error">{actionError}</p> : null}

            {assets.length === 0 ? (
              <div className="empty-state">
                <h3>当前没有素材</h3>
                <p>可以先导入图片或视频，或创建一个文本素材。</p>
              </div>
            ) : (
              <div className="asset-list">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={selectedAssetId === asset.id ? 'asset-item is-active' : 'asset-item'}
                    onClick={() => setSelectedAssetId(asset.id)}
                  >
                    <div className="asset-item__header">
                      <strong>{asset.displayName}</strong>
                      <span className="status-chip">{asset.assetType}</span>
                    </div>
                    <p className="muted-text">{asset.fileName}</p>
                    <ul className="project-meta">
                      <li>大小：{formatFileSize(asset.fileSize)}</li>
                      <li>更新时间：{formatDate(asset.updatedAt)}</li>
                    </ul>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="page-stack">
          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Detail</p>
                <h3>素材基础信息</h3>
              </div>
            </div>

            {!selectedAsset ? (
              <p className="muted-text">请先从左侧选择一个素材。</p>
            ) : (
              <>
                <div className="asset-preview-card">
                  {selectedAsset.assetType === 'image' ? (
                    <img className="asset-preview-image" src={selectedAsset.fileUrl} alt={selectedAsset.displayName} />
                  ) : null}
                  {selectedAsset.assetType === 'video' ? (
                    <video className="asset-preview-video" src={selectedAsset.fileUrl} controls preload="metadata" />
                  ) : null}
                  {selectedAsset.assetType === 'text' ? (
                    <pre className="asset-preview-text">{selectedAsset.textContent}</pre>
                  ) : null}
                </div>

                <dl className="detail-grid">
                  <div>
                    <dt>展示名</dt>
                    <dd>{selectedAsset.displayName}</dd>
                  </div>
                  <div>
                    <dt>文件名</dt>
                    <dd>{selectedAsset.fileName}</dd>
                  </div>
                  <div>
                    <dt>素材类型</dt>
                    <dd>{selectedAsset.assetType}</dd>
                  </div>
                  <div>
                    <dt>文件大小</dt>
                    <dd>{formatFileSize(selectedAsset.fileSize)}</dd>
                  </div>
                  <div>
                    <dt>相对路径</dt>
                    <dd>{selectedAsset.relativePath}</dd>
                  </div>
                  <div>
                    <dt>最近使用</dt>
                    <dd>{formatDate(selectedAsset.lastUsedAt)}</dd>
                  </div>
                </dl>
              </>
            )}
          </section>

          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Attach</p>
                <h3>加入任务</h3>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <h3>当前没有任务承接壳</h3>
                <p>先进入任务素材面板创建一个任务，再把素材加入任务。</p>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => navigate(`/projects/${project.id}/tasks`)}
                >
                  去任务素材面板
                </button>
              </div>
            ) : (
              <>
                <label className="form-field">
                  <span>目标任务</span>
                  <select
                    className="form-select"
                    value={selectedTaskId}
                    onChange={(event) => setSelectedTaskId(event.target.value)}
                  >
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="settings-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void handleAttachAsset()}
                    disabled={!selectedAsset || !selectedTaskId || isAttaching}
                  >
                    {isAttaching ? '加入中...' : '加入当前任务'}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}/tasks`)}
                  >
                    查看任务素材面板
                  </button>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
