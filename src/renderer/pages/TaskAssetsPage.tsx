import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AssetRecord } from '@shared/types/asset';
import type { ProjectRecord } from '@shared/types/project';
import type { TaskAssetRecord, TaskRecord } from '@shared/types/task';

function formatDate(value: string | null): string {
  if (!value) {
    return '暂无';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function TaskAssetsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [taskAssets, setTaskAssets] = useState<TaskAssetRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assetToAttach, setAssetToAttach] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const attachedAssetIds = useMemo(
    () => new Set(taskAssets.map((item) => item.assetId)),
    [taskAssets],
  );
  const attachableAssets = useMemo(
    () => assets.filter((asset) => !attachedAssetIds.has(asset.id)),
    [assets, attachedAssetIds],
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const loadBaseData = async (targetProjectId: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [projectRecord, taskRecords, assetRecords] = await Promise.all([
        window.projectApi.getProjectById(targetProjectId),
        window.taskApi.listTasks(targetProjectId),
        window.assetApi.listAssets(targetProjectId, { keyword: '', type: 'all' }),
      ]);

      setProject(projectRecord);
      setTasks(taskRecords);
      setAssets(assetRecords);
      setSelectedTaskId((current) =>
        current && taskRecords.some((task) => task.id === current) ? current : taskRecords[0]?.id ?? null,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '任务素材面板读取失败。');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTaskAssets = async (taskId: string) => {
    try {
      const result = await window.taskApi.listTaskAssets(taskId);
      setTaskAssets(result);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '任务素材读取失败。');
    }
  };

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      setProject(null);
      return;
    }

    void loadBaseData(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskAssets([]);
      return;
    }

    void loadTaskAssets(selectedTaskId);
  }, [selectedTaskId]);

  useEffect(() => {
    setAssetToAttach((current) => {
      if (!current) {
        return attachableAssets[0]?.id ?? '';
      }

      return attachableAssets.some((asset) => asset.id === current) ? current : attachableAssets[0]?.id ?? '';
    });
  }, [attachableAssets]);

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId) {
      return;
    }

    setIsCreatingTask(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const created = await window.taskApi.createTask(projectId, { title: taskTitle });
      setTaskTitle('');
      setActionSuccess('任务承接壳已创建。');
      await loadBaseData(projectId);
      setSelectedTaskId(created.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '任务承接壳创建失败。');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleAttachAsset = async () => {
    if (!selectedTaskId || !assetToAttach) {
      setActionError('请先选择任务和素材。');
      return;
    }

    setIsAttaching(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await window.taskApi.attachAsset(selectedTaskId, assetToAttach);
      setActionSuccess('素材已加入当前任务。');
      await loadTaskAssets(selectedTaskId);
      if (projectId) {
        await loadBaseData(projectId);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材加入任务失败。');
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!selectedTaskId) {
      return;
    }

    setRemovingAssetId(assetId);
    setActionError(null);
    setActionSuccess(null);

    try {
      await window.taskApi.removeAsset(selectedTaskId, assetId);
      setActionSuccess('素材已从当前任务移出。');
      await loadTaskAssets(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材移出任务失败。');
    } finally {
      setRemovingAssetId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 2-2</p>
        <h2>正在读取任务素材面板...</h2>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 2-2</p>
        <h2>任务素材面板读取失败</h2>
        <p className="inline-error">{loadError}</p>
        <Link className="ghost-button link-button" to="/">
          返回项目列表
        </Link>
      </section>
    );
  }

  if (!projectId || !project) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 2-2</p>
        <h2>项目不存在</h2>
        <p className="muted-text">未找到项目，请返回项目列表重新选择。</p>
        <Link className="ghost-button link-button" to="/">
          返回项目列表
        </Link>
      </section>
    );
  }

  return (
    <section className="page-stack task-assets-layout">
      <div className="page-card page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 2-2</p>
            <h2>任务内素材面板</h2>
            <p className="page-helper">
              当前只承接任务素材挂接，不进入任务执行、结果输出或审核链路。
            </p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to={`/projects/${project.id}`}>
              返回项目主页
            </Link>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/assets`}>
              进入素材库
            </Link>
          </div>
        </div>
      </div>

      <div className="task-assets-grid">
        <aside className="page-stack">
          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Task Shell</p>
                <h3>创建最小任务承接壳</h3>
              </div>
              <p className="page-helper">该对象只用于素材挂接，不展开任务系统。</p>
            </div>

            <form className="page-stack" onSubmit={handleCreateTask}>
              <label className="form-field">
                <span>任务标题</span>
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="输入任务标题"
                  maxLength={120}
                  disabled={isCreatingTask}
                />
              </label>

              <div className="settings-actions">
                <button className="primary-button" type="submit" disabled={isCreatingTask}>
                  {isCreatingTask ? '创建中...' : '创建任务承接壳'}
                </button>
              </div>
            </form>
          </section>

          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Tasks</p>
                <h3>任务列表</h3>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <h3>当前没有任务承接壳</h3>
                <p>先创建一个任务承接壳，再在右侧面板中挂接素材。</p>
              </div>
            ) : (
              <div className="task-list">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={selectedTaskId === task.id ? 'task-item is-active' : 'task-item'}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <strong>{task.title}</strong>
                    <p className="muted-text">创建于 {formatDate(task.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="page-stack">
          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Panel</p>
                <h3>{selectedTask ? `${selectedTask.title} 的素材面板` : '任务素材面板'}</h3>
              </div>
            </div>

            {actionSuccess ? <p className="success-text">{actionSuccess}</p> : null}
            {actionError ? <p className="inline-error">{actionError}</p> : null}

            {!selectedTask ? (
              <p className="muted-text">请选择一个任务承接壳。</p>
            ) : (
              <>
                <div className="settings-grid">
                  <label className="form-field">
                    <span>可加入素材</span>
                    <select
                      className="form-select"
                      value={assetToAttach}
                      onChange={(event) => setAssetToAttach(event.target.value)}
                      disabled={attachableAssets.length === 0}
                    >
                      {attachableAssets.length === 0 ? (
                        <option value="">暂无可加入素材</option>
                      ) : (
                        attachableAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.displayName} ({asset.assetType})
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>

                <div className="settings-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void handleAttachAsset()}
                    disabled={attachableAssets.length === 0 || !assetToAttach || isAttaching}
                  >
                    {isAttaching ? '加入中...' : '加入当前任务'}
                  </button>
                </div>

                {taskAssets.length === 0 ? (
                  <div className="empty-state">
                    <h3>当前任务还没有素材</h3>
                    <p>可以在上方直接加入素材，或从素材库页选择素材后加入。</p>
                  </div>
                ) : (
                  <div className="task-asset-list">
                    {taskAssets.map((item) => (
                      <article key={item.id} className="task-asset-item">
                        <div className="task-asset-item__main">
                          <strong>{item.asset.displayName}</strong>
                          <p className="muted-text">
                            {item.asset.assetType} · 最近使用 {formatDate(item.asset.lastUsedAt)}
                          </p>
                          <p className="muted-text">加入时间：{formatDate(item.addedAt)}</p>
                        </div>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => void handleRemoveAsset(item.assetId)}
                          disabled={removingAssetId === item.assetId}
                        >
                          {removingAssetId === item.assetId ? '移除中...' : '移出任务'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </div>
    </section>
  );
}
