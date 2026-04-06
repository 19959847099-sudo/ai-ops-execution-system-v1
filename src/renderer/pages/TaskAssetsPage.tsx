import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { AssetRecord } from '@shared/types/asset';
import type { TaskPreparationMemorySnapshot } from '@shared/types/memory';
import type { ProjectRecord } from '@shared/types/project';
import type { TaskAssetRecord, TaskCandidateRecord, TaskRecord, TaskStatus } from '@shared/types/task';

function formatDate(value: string | null): string {
  if (!value) {
    return '暂无';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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

function formatTaskForm(taskForm: TaskRecord['taskForm']): string {
  return taskForm === 'article' ? '图文' : '视频';
}

export function TaskAssetsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [taskAssets, setTaskAssets] = useState<TaskAssetRecord[]>([]);
  const [candidates, setCandidates] = useState<TaskCandidateRecord[]>([]);
  const [memorySnapshot, setMemorySnapshot] = useState<TaskPreparationMemorySnapshot | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assetToAttach, setAssetToAttach] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTaskData, setIsLoadingTaskData] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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
  const canEditAssets = selectedTask?.status === 'draft';
  const canGenerate = selectedTask?.status === 'draft' && candidates.length === 0;

  const syncSelectedTask = (taskRecords: TaskRecord[], preferredTaskId?: string | null) => {
    setSelectedTaskId((current) => {
      const taskIdFromUrl = preferredTaskId ?? searchParams.get('taskId');
      if (taskIdFromUrl && taskRecords.some((task) => task.id === taskIdFromUrl)) {
        return taskIdFromUrl;
      }

      if (current && taskRecords.some((task) => task.id === current)) {
        return current;
      }

      return taskRecords[0]?.id ?? null;
    });
  };

  const loadBaseData = async (targetProjectId: string, preferredTaskId?: string | null) => {
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
      syncSelectedTask(taskRecords, preferredTaskId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '任务承接页读取失败。');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSelectedTaskData = async (taskId: string) => {
    setIsLoadingTaskData(true);
    setActionError(null);

    try {
      const [taskAssetResult, snapshot, candidateResult] = await Promise.all([
        window.taskApi.listTaskAssets(taskId),
        window.memoryApi.getTaskPreparationMemorySnapshot(taskId),
        window.taskApi.listTaskCandidates(taskId),
      ]);

      setTaskAssets(taskAssetResult);
      setMemorySnapshot(snapshot);
      setCandidates(candidateResult);
      setMemoryError(null);
    } catch (error) {
      setTaskAssets([]);
      setCandidates([]);
      setMemorySnapshot(null);
      setMemoryError(error instanceof Error ? error.message : '任务前常驻记忆读取失败。');
    } finally {
      setIsLoadingTaskData(false);
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
      setCandidates([]);
      setMemorySnapshot(null);
      setMemoryError(null);
      return;
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('taskId', selectedTaskId);
      return next;
    });
    void loadSelectedTaskData(selectedTaskId);
  }, [selectedTaskId, setSearchParams]);

  useEffect(() => {
    setAssetToAttach((current) => {
      if (!current) {
        return attachableAssets[0]?.id ?? '';
      }

      return attachableAssets.some((asset) => asset.id === current) ? current : attachableAssets[0]?.id ?? '';
    });
  }, [attachableAssets]);

  const handleAttachAsset = async () => {
    if (!selectedTaskId || !assetToAttach || !canEditAssets) {
      return;
    }

    setIsAttaching(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await window.taskApi.attachAsset(selectedTaskId, assetToAttach);
      setActionSuccess('素材已加入当前任务。');
      await loadBaseData(projectId ?? '', selectedTaskId);
      await loadSelectedTaskData(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材加入任务失败。');
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!selectedTaskId || !canEditAssets) {
      return;
    }

    setRemovingAssetId(assetId);
    setActionError(null);
    setActionSuccess(null);

    try {
      await window.taskApi.removeAsset(selectedTaskId, assetId);
      setActionSuccess('素材已从当前任务移出。');
      await loadBaseData(projectId ?? '', selectedTaskId);
      await loadSelectedTaskData(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材移出任务失败。');
    } finally {
      setRemovingAssetId(null);
    }
  };

  const handleGenerateCandidates = async () => {
    if (!selectedTaskId || !canGenerate) {
      return;
    }

    setIsGenerating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await window.taskApi.generateTaskCandidates(selectedTaskId);
      setCandidates(result);
      setActionSuccess('候选已生成。');
      if (projectId) {
        await loadBaseData(projectId, selectedTaskId);
      }
      await loadSelectedTaskData(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '候选生成失败。');
      if (projectId) {
        await loadBaseData(projectId, selectedTaskId);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 4-2</p>
        <h2>正在读取任务承接页...</h2>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 4-2</p>
        <h2>任务承接页读取失败</h2>
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
        <p className="eyebrow">Stage 4-2</p>
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
            <p className="eyebrow">Stage 4-2</p>
            <h2>任务主链承接页</h2>
            <p className="page-helper">
              这里负责读取统一常驻记忆结果、读取当前任务挂接素材、调用固定 API 生成候选，并在当前任务维度中展示结果。
            </p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to={`/projects/${project.id}`}>
              返回项目主页
            </Link>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/assets`}>
              打开素材库
            </Link>
          </div>
        </div>
      </div>

      <div className="task-assets-grid">
        <aside className="page-stack">
          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Tasks</p>
                <h3>任务列表</h3>
              </div>
              <Link className="ghost-button link-button" to={`/projects/${project.id}`}>
                返回主页发起任务
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <h3>当前还没有任务</h3>
                <p>阶段 4 规定由项目主页中的任务发起卡作为主链入口，请先返回项目主页创建任务。</p>
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
                    <p className="muted-text">目标：{task.goal}</p>
                    <p className="muted-text">
                      {formatTaskForm(task.taskForm)} · {formatTaskStatus(task.status)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Attached Assets</p>
                <h3>当前任务素材</h3>
              </div>
              <p className="page-helper">
                当前只复用阶段 2 的任务素材挂接结果。任务一旦开始生成候选，本阶段不再扩展重生成闭环。
              </p>
            </div>

            {actionSuccess ? <p className="success-text">{actionSuccess}</p> : null}
            {actionError ? <p className="inline-error">{actionError}</p> : null}

            {!selectedTask ? (
              <p className="muted-text">请选择一个任务后查看或调整素材。</p>
            ) : (
              <>
                <div className="settings-grid">
                  <label className="form-field">
                    <span>可加入素材</span>
                    <select
                      className="form-select"
                      value={assetToAttach}
                      onChange={(event) => setAssetToAttach(event.target.value)}
                      disabled={!canEditAssets || attachableAssets.length === 0}
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
                    disabled={!canEditAssets || attachableAssets.length === 0 || !assetToAttach || isAttaching}
                  >
                    {isAttaching ? '加入中...' : '加入当前任务'}
                  </button>
                  {!canEditAssets && selectedTask.status !== 'draft' ? (
                    <p className="muted-text">当前任务已进入生成流程，阶段 4 不再开放素材重配与重生成闭环。</p>
                  ) : null}
                </div>

                {taskAssets.length === 0 ? (
                  <div className="empty-state">
                    <h3>当前任务还没有挂接素材</h3>
                    <p>可以在这里加入素材，也可以先回到素材库页完成素材整理后再回来。</p>
                  </div>
                ) : (
                  <div className="task-asset-list">
                    {taskAssets.map((item) => (
                      <article key={item.id} className="task-asset-item">
                        <div className="task-asset-item__main">
                          <strong>{item.asset.displayName}</strong>
                          <p className="muted-text">
                            {item.asset.assetType} · 最近使用：{formatDate(item.asset.lastUsedAt)}
                          </p>
                          <p className="muted-text">加入时间：{formatDate(item.addedAt)}</p>
                        </div>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => void handleRemoveAsset(item.assetId)}
                          disabled={!canEditAssets || removingAssetId === item.assetId}
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
        </aside>

        <section className="page-stack">
          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Task Context</p>
                <h3>{selectedTask ? `${selectedTask.title} 的主链生成承接` : '任务主链生成承接'}</h3>
              </div>
            </div>

            {!selectedTask ? (
              <p className="muted-text">请选择一个任务后查看任务信息与生成候选。</p>
            ) : (
              <>
                <div className="detail-grid">
                  <div>
                    <dt>主题</dt>
                    <dd>{selectedTask.title}</dd>
                  </div>
                  <div>
                    <dt>目标</dt>
                    <dd>{selectedTask.goal}</dd>
                  </div>
                  <div>
                    <dt>形式</dt>
                    <dd>{formatTaskForm(selectedTask.taskForm)}</dd>
                  </div>
                  <div>
                    <dt>生成状态</dt>
                    <dd>{formatTaskStatus(selectedTask.status)}</dd>
                  </div>
                </div>

                <label className="form-field">
                  <span>补充要求</span>
                  <textarea
                    className="form-textarea readonly-input"
                    value={selectedTask.supplementalRequirements || '暂无'}
                    readOnly
                  />
                </label>

                <div className="settings-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void handleGenerateCandidates()}
                    disabled={!canGenerate || isGenerating || isLoadingTaskData}
                  >
                    {isGenerating ? '生成中...' : '生成 2～3 个候选'}
                  </button>
                  {selectedTask.status === 'failed' ? (
                    <p className="inline-error">当前任务生成失败。阶段 4 只保留失败状态，不补完整重试闭环。</p>
                  ) : null}
                </div>
              </>
            )}
          </section>

          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Resident Memory Snapshot</p>
                <h3>任务前统一常驻记忆结果</h3>
              </div>
              <p className="page-helper">
                阶段 4 直接复用阶段 3 的统一读取结果，不在主链内重新分散读取并重复拼接项目常驻记忆与用户偏好常驻记忆。
              </p>
            </div>

            {!selectedTask ? (
              <p className="muted-text">请选择一个任务后查看任务前常驻记忆快照。</p>
            ) : isLoadingTaskData ? (
              <p className="muted-text">正在读取任务上下文...</p>
            ) : memoryError ? (
              <p className="inline-error">{memoryError}</p>
            ) : memorySnapshot ? (
              <>
                <div className="detail-grid">
                  <div>
                    <dt>任务标题</dt>
                    <dd>{memorySnapshot.taskTitle}</dd>
                  </div>
                  <div>
                    <dt>项目 ID</dt>
                    <dd>{memorySnapshot.projectId}</dd>
                  </div>
                </div>

                <div className="task-memory-grid">
                  <section className="memory-card">
                    <h4>项目常驻记忆</h4>
                    <dl className="memory-list">
                      <div>
                        <dt>一句话定义</dt>
                        <dd>{memorySnapshot.projectResidentMemory.oneLineDefinition || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>目标用户</dt>
                        <dd>{memorySnapshot.projectResidentMemory.targetAudience || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>核心价值</dt>
                        <dd>{memorySnapshot.projectResidentMemory.coreValue || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>当前重点</dt>
                        <dd>{memorySnapshot.projectResidentMemory.currentFocus || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>禁止表达</dt>
                        <dd>{memorySnapshot.projectResidentMemory.forbiddenExpressions || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>固定约束</dt>
                        <dd>{memorySnapshot.projectResidentMemory.fixedConstraints || '暂无'}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="memory-card">
                    <h4>用户偏好常驻记忆</h4>
                    <dl className="memory-list">
                      <div>
                        <dt>产品偏好</dt>
                        <dd>{memorySnapshot.userResidentMemory.productPreference || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>表达偏好</dt>
                        <dd>{memorySnapshot.userResidentMemory.expressionPreference || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>设计偏好</dt>
                        <dd>{memorySnapshot.userResidentMemory.designPreference || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>开发偏好</dt>
                        <dd>{memorySnapshot.userResidentMemory.developmentPreference || '暂无'}</dd>
                      </div>
                      <div>
                        <dt>成本偏好</dt>
                        <dd>{memorySnapshot.userResidentMemory.costPreference || '暂无'}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </>
            ) : (
              <p className="muted-text">当前没有可显示的任务前常驻记忆快照。</p>
            )}
          </section>

          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div>
                <p className="eyebrow">Candidates</p>
                <h3>当前任务候选</h3>
              </div>
              <p className="page-helper">
                候选只在当前任务维度内承接，不引入审核状态、打回语义、项目级结果列表或回流语义。
              </p>
            </div>

            {!selectedTask ? (
              <p className="muted-text">请选择一个任务后查看候选。</p>
            ) : isLoadingTaskData ? (
              <p className="muted-text">正在读取当前任务候选...</p>
            ) : candidates.length === 0 ? (
              <div className="empty-state">
                <h3>当前还没有候选</h3>
                <p>当前任务还未生成候选。确认任务信息、记忆快照和挂接素材后，可在上方执行生成。</p>
              </div>
            ) : (
              <div className="task-candidate-list">
                {candidates.map((candidate) => (
                  <article key={candidate.id} className="candidate-card">
                    <div className="candidate-card__header">
                      <div>
                        <p className="eyebrow">Candidate {candidate.sequence}</p>
                        <h4>{candidate.title}</h4>
                      </div>
                      <span className="status-chip">
                        {candidate.candidateType === 'article' ? '图文候选' : '视频候选'}
                      </span>
                    </div>

                    {candidate.candidateType === 'article' ? (
                      <div className="candidate-body">
                        <p>{candidate.body}</p>
                      </div>
                    ) : (
                      <div className="page-stack">
                        <p className="candidate-body">{candidate.structuredDescription}</p>
                        <div className="candidate-segment-list">
                          {candidate.segments.map((segment, index) => (
                            <section key={`${candidate.id}-${index}`} className="candidate-segment">
                              <strong>{segment.heading}</strong>
                              <p>{segment.content}</p>
                            </section>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="muted-text">生成时间：{formatDate(candidate.generatedAt)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </section>
  );
}
