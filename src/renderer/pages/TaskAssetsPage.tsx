import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { AssetRecord } from '@shared/types/asset';
import type { TaskPreparationMemorySnapshot } from '@shared/types/memory';
import type { ProjectRecord } from '@shared/types/project';
import type { ResultRecord, ResultReviewActionRecord } from '@shared/types/result';
import type { TaskAssetRecord, TaskRecord, TaskStatus } from '@shared/types/task';

function formatDate(value: string | null): string {
  if (!value) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatTaskStatus(status: TaskStatus): string {
  if (status === 'generating') return '生成中';
  if (status === 'ready') return '已产出候选';
  if (status === 'failed') return '生成失败';
  return '待生成';
}

function formatTaskForm(taskForm: TaskRecord['taskForm']): string {
  return taskForm === 'article' ? '图文' : '视频';
}

function formatResultStatus(status: ResultRecord['status']): string {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已打回';
  return '待审核';
}

function formatReviewAction(action: ResultReviewActionRecord['actionType']): string {
  if (action === 'approved') return '通过';
  if (action === 'saved_as_asset') return '保存文本为素材';
  return '打回并再生成';
}

function renderResultPreview(result: ResultRecord): string {
  return result.resultType === 'article' ? result.body : result.structuredDescription;
}

export function TaskAssetsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [taskAssets, setTaskAssets] = useState<TaskAssetRecord[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [reviewActions, setReviewActions] = useState<ResultReviewActionRecord[]>([]);
  const [memorySnapshot, setMemorySnapshot] = useState<TaskPreparationMemorySnapshot | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assetToAttach, setAssetToAttach] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTaskData, setIsLoadingTaskData] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [processingResultId, setProcessingResultId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const attachedAssetIds = useMemo(() => new Set(taskAssets.map((item) => item.assetId)), [taskAssets]);
  const attachableAssets = useMemo(
    () => assets.filter((asset) => !attachedAssetIds.has(asset.id)),
    [assets, attachedAssetIds],
  );
  const assetNameMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.displayName])), [assets]);
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [selectedTaskId, tasks]);
  const approvedResult = useMemo(() => results.find((result) => result.status === 'approved') ?? null, [results]);
  const reviewableResults = useMemo(() => results.filter((result) => result.status !== 'approved'), [results]);
  const canEditAssets = selectedTask?.status === 'draft' && results.length === 0;
  const canGenerate = Boolean(selectedTask) && results.length === 0 && selectedTask?.status !== 'generating';

  const syncSelectedTask = (taskRecords: TaskRecord[], preferredTaskId?: string | null) => {
    setSelectedTaskId((current) => {
      const fromUrl = preferredTaskId ?? searchParams.get('taskId');
      if (fromUrl && taskRecords.some((task) => task.id === fromUrl)) return fromUrl;
      if (current && taskRecords.some((task) => task.id === current)) return current;
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
      setLoadError(error instanceof Error ? error.message : '任务审核页读取失败。');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSelectedTaskData = async (taskId: string) => {
    setIsLoadingTaskData(true);
    setActionError(null);
    try {
      const [taskAssetResult, snapshot, resultRecords, actionRecords] = await Promise.all([
        window.taskApi.listTaskAssets(taskId),
        window.memoryApi.getTaskPreparationMemorySnapshot(taskId),
        window.resultApi.listTaskResults(taskId),
        window.resultApi.listTaskReviewActions(taskId),
      ]);
      setTaskAssets(taskAssetResult);
      setMemorySnapshot(snapshot);
      setResults(resultRecords);
      setReviewActions(actionRecords);
      setMemoryError(null);
    } catch (error) {
      setTaskAssets([]);
      setResults([]);
      setReviewActions([]);
      setMemorySnapshot(null);
      setMemoryError(error instanceof Error ? error.message : '任务上下文读取失败。');
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
      setResults([]);
      setReviewActions([]);
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
      if (!current) return attachableAssets[0]?.id ?? '';
      return attachableAssets.some((asset) => asset.id === current) ? current : attachableAssets[0]?.id ?? '';
    });
  }, [attachableAssets]);

  const updateReviewNote = (resultId: string, value: string) => {
    setReviewNotes((current) => ({ ...current, [resultId]: value }));
  };

  const refreshAfterAction = async (taskId: string) => {
    if (projectId) await loadBaseData(projectId, taskId);
    await loadSelectedTaskData(taskId);
  };

  const handleAttachAsset = async () => {
    if (!selectedTaskId || !assetToAttach || !canEditAssets) return;
    setIsAttaching(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await window.taskApi.attachAsset(selectedTaskId, assetToAttach);
      setActionSuccess('素材已加入当前任务。');
      await refreshAfterAction(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材加入任务失败。');
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!selectedTaskId || !canEditAssets) return;
    setRemovingAssetId(assetId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await window.taskApi.removeAsset(selectedTaskId, assetId);
      setActionSuccess('素材已从当前任务移出。');
      await refreshAfterAction(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '素材移出任务失败。');
    } finally {
      setRemovingAssetId(null);
    }
  };

  const handleGenerateInitialResults = async () => {
    if (!selectedTaskId || !canGenerate) return;
    setIsGenerating(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await window.taskApi.generateTaskCandidates(selectedTaskId);
      setActionSuccess('候选结果已进入结果层，当前可以开始审核。');
      await refreshAfterAction(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '候选生成失败。');
      await refreshAfterAction(selectedTaskId);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveResult = async (resultId: string) => {
    if (!selectedTaskId) return;
    setProcessingResultId(resultId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await window.resultApi.approveResult(selectedTaskId, resultId, reviewNotes[resultId] ?? '');
      setActionSuccess('结果已通过。');
      await loadSelectedTaskData(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '结果通过失败。');
    } finally {
      setProcessingResultId(null);
    }
  };

  const handleRegenerateResult = async (resultId: string, useNote: boolean) => {
    if (!selectedTaskId) return;
    const note = useNote ? (reviewNotes[resultId] ?? '').trim() : '';
    if (useNote && !note) {
      setActionError('请先输入一句审核意见，再触发基于意见再生成。');
      return;
    }

    setProcessingResultId(resultId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await window.resultApi.regenerateResult(selectedTaskId, resultId, { note });
      setActionSuccess(useNote ? '已基于一句意见再生成候选。' : '已打回并重新生成候选。');
      await refreshAfterAction(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '打回重生成失败。');
    } finally {
      setProcessingResultId(null);
    }
  };

  const handleSaveResultAsAsset = async (resultId: string) => {
    setProcessingResultId(resultId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const asset = await window.resultApi.saveResultAsTextAsset(resultId);
      setActionSuccess(`结果文本已人工保存为素材：${asset.displayName}`);
      if (selectedTaskId) await refreshAfterAction(selectedTaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '保存文本为素材失败。');
    } finally {
      setProcessingResultId(null);
    }
  };

  if (isLoading) {
    return <section className="page-card page-stack"><p className="eyebrow">Stage 5-1</p><h2>正在读取任务审核页...</h2></section>;
  }

  if (loadError) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 5-1</p>
        <h2>任务审核页读取失败</h2>
        <p className="inline-error">{loadError}</p>
        <Link className="ghost-button link-button" to="/">返回项目列表</Link>
      </section>
    );
  }

  if (!projectId || !project) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 5-1</p>
        <h2>项目不存在</h2>
        <p className="muted-text">未找到项目，请返回项目列表重新选择。</p>
        <Link className="ghost-button link-button" to="/">返回项目列表</Link>
      </section>
    );
  }

  return (
    <section className="page-stack task-assets-layout">
      <div className="page-card page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 5-1</p>
            <h2>任务内审核页</h2>
            <p className="page-helper">这里负责结果层承接、人工审核、基于一句意见再生成，以及人工保存文本为素材，不进入自动回流与临时记忆更新。</p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to={`/projects/${project.id}`}>返回项目主页</Link>
            <Link className="ghost-button link-button" to={`/projects/${project.id}/results`}>进入项目结果列表</Link>
          </div>
        </div>
      </div>

      <div className="task-assets-grid">
        <aside className="page-stack">
          <section className="page-card page-stack">
            <div className="settings-section__header">
              <div><p className="eyebrow">Tasks</p><h3>任务列表</h3></div>
              <Link className="ghost-button link-button" to={`/projects/${project.id}`}>返回主页发起任务</Link>
            </div>
            {tasks.length === 0 ? (
              <div className="empty-state"><h3>当前还没有任务</h3><p>先从项目主页发起任务，再进入当前页进行生成与审核。</p></div>
            ) : (
              <div className="task-list">
                {tasks.map((task) => (
                  <button key={task.id} type="button" className={selectedTaskId === task.id ? 'task-item is-active' : 'task-item'} onClick={() => setSelectedTaskId(task.id)}>
                    <strong>{task.title}</strong>
                    <p className="muted-text">目标：{task.goal}</p>
                    <p className="muted-text">{formatTaskForm(task.taskForm)} · {formatTaskStatus(task.status)}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <div className="page-stack">
          {!selectedTask ? (
            <section className="page-card page-stack">
              <p className="eyebrow">Task Review</p>
              <h3>请选择一个任务</h3>
              <p className="muted-text">从左侧任务列表选择一个任务，进入当前任务维度的结果审核。</p>
            </section>
          ) : (
            <>
              <section className="page-card page-stack">
                <div className="settings-section__header">
                  <div><p className="eyebrow">Current Task</p><h3>{selectedTask.title}</h3></div>
                  <span className="status-chip">{formatTaskStatus(selectedTask.status)}</span>
                </div>

                <div className="detail-grid">
                  <div><dt>任务目标</dt><dd>{selectedTask.goal}</dd></div>
                  <div><dt>任务形式</dt><dd>{formatTaskForm(selectedTask.taskForm)}</dd></div>
                  <div><dt>补充要求</dt><dd>{selectedTask.supplementalRequirements || '暂无'}</dd></div>
                  <div><dt>更新时间</dt><dd>{formatDate(selectedTask.updatedAt)}</dd></div>
                </div>

                {actionError ? <p className="inline-error">{actionError}</p> : null}
                {actionSuccess ? <p className="success-text">{actionSuccess}</p> : null}

                <div className="page-actions">
                  <button className="primary-button" type="button" onClick={() => void handleGenerateInitialResults()} disabled={!canGenerate || isGenerating || isLoadingTaskData}>
                    {isGenerating ? '正在生成候选...' : results.length === 0 ? '生成候选并进入审核' : '当前结果已生成'}
                  </button>
                  <Link className="ghost-button link-button" to={`/projects/${project.id}/results`}>打开项目结果回看</Link>
                </div>

                {selectedTask.status === 'failed' ? (
                  <p className="inline-error">上一次生成失败。你可以检查素材与常驻记忆后，再从待审核结果上继续打回重生成。</p>
                ) : null}
              </section>

              <section className="page-card page-stack">
                <div className="settings-section__header">
                  <div><p className="eyebrow">Assets</p><h3>当前任务素材</h3></div>
                  <span className="muted-text">{canEditAssets ? '生成前可编辑' : '结果层成立后只读'}</span>
                </div>

                {canEditAssets ? (
                  <div className="settings-actions">
                    <select className="form-select" value={assetToAttach} onChange={(event) => setAssetToAttach(event.target.value)} disabled={isAttaching || attachableAssets.length === 0}>
                      {attachableAssets.length === 0 ? (
                        <option value="">暂无可加入素材</option>
                      ) : (
                        attachableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.displayName}</option>)
                      )}
                    </select>
                    <button className="primary-button" type="button" onClick={() => void handleAttachAsset()} disabled={isAttaching || !assetToAttach || attachableAssets.length === 0}>
                      {isAttaching ? '加入中...' : '加入任务'}
                    </button>
                    <Link className="ghost-button link-button" to={`/projects/${project.id}/assets`}>打开素材库</Link>
                  </div>
                ) : (
                  <p className="muted-text">当前任务已经进入结果层，素材挂接保持只读；如需更换素材，请在对应候选上执行打回重生成。</p>
                )}

                {taskAssets.length === 0 ? (
                  <div className="empty-state">
                    <h3>当前任务还没有挂接素材</h3>
                    <p>主链会继续读取统一常驻记忆，但如果需要更强约束，建议先挂接素材再生成候选。</p>
                  </div>
                ) : (
                  <div className="task-asset-list">
                    {taskAssets.map((item) => (
                      <article key={item.id} className="task-asset-item">
                        <div className="task-asset-item__main">
                          <strong>{item.asset.displayName}</strong>
                          <p className="muted-text">{item.asset.assetType} · 最近使用：{formatDate(item.asset.lastUsedAt)}</p>
                          <p className="muted-text">加入时间：{formatDate(item.addedAt)}</p>
                        </div>
                        {canEditAssets ? (
                          <button className="danger-button" type="button" onClick={() => void handleRemoveAsset(item.assetId)} disabled={removingAssetId === item.assetId}>
                            {removingAssetId === item.assetId ? '移出中...' : '移出任务'}
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="page-card page-stack">
                <div className="settings-section__header">
                  <div><p className="eyebrow">Resident Memory</p><h3>任务前常驻记忆快照</h3></div>
                </div>

                {isLoadingTaskData ? <p className="muted-text">正在读取当前任务的统一常驻记忆快照...</p> : null}
                {memoryError ? <p className="inline-error">{memoryError}</p> : null}

                {memorySnapshot ? (
                  <div className="task-memory-grid">
                    <article className="memory-card">
                      <h4>项目常驻记忆</h4>
                      <dl className="memory-list">
                        <div><dt>一句话定义</dt><dd>{memorySnapshot.projectResidentMemory.oneLineDefinition || '暂无'}</dd></div>
                        <div><dt>目标用户</dt><dd>{memorySnapshot.projectResidentMemory.targetAudience || '暂无'}</dd></div>
                        <div><dt>核心价值</dt><dd>{memorySnapshot.projectResidentMemory.coreValue || '暂无'}</dd></div>
                        <div><dt>当前重点</dt><dd>{memorySnapshot.projectResidentMemory.currentFocus || '暂无'}</dd></div>
                        <div><dt>禁止表达</dt><dd>{memorySnapshot.projectResidentMemory.forbiddenExpressions || '暂无'}</dd></div>
                        <div><dt>固定约束</dt><dd>{memorySnapshot.projectResidentMemory.fixedConstraints || '暂无'}</dd></div>
                      </dl>
                    </article>

                    <article className="memory-card">
                      <h4>用户偏好常驻记忆</h4>
                      <dl className="memory-list">
                        <div><dt>产品偏好</dt><dd>{memorySnapshot.userResidentMemory.productPreference || '暂无'}</dd></div>
                        <div><dt>表达偏好</dt><dd>{memorySnapshot.userResidentMemory.expressionPreference || '暂无'}</dd></div>
                        <div><dt>设计偏好</dt><dd>{memorySnapshot.userResidentMemory.designPreference || '暂无'}</dd></div>
                        <div><dt>开发偏好</dt><dd>{memorySnapshot.userResidentMemory.developmentPreference || '暂无'}</dd></div>
                        <div><dt>成本偏好</dt><dd>{memorySnapshot.userResidentMemory.costPreference || '暂无'}</dd></div>
                      </dl>
                    </article>
                  </div>
                ) : null}
              </section>

              <section className="page-card page-stack">
                <div className="settings-section__header">
                  <div><p className="eyebrow">Results</p><h3>当前任务结果与审核动作</h3></div>
                </div>

                {isLoadingTaskData ? (
                  <p className="muted-text">正在读取当前任务结果...</p>
                ) : results.length === 0 ? (
                  <div className="empty-state">
                    <h3>当前还没有进入结果层的候选</h3>
                    <p>先用上方主链入口生成候选，生成完成后这里会承接待审核结果。</p>
                  </div>
                ) : (
                  <div className="page-stack">
                    {approvedResult ? (
                      <article className="candidate-card result-card result-card--approved">
                        <div className="candidate-card__header">
                          <div><p className="eyebrow">Approved Result</p><h4>{approvedResult.title}</h4></div>
                          <span className="status-chip is-active">{formatResultStatus(approvedResult.status)}</span>
                        </div>

                        <p className="candidate-body">{renderResultPreview(approvedResult)}</p>

                        {approvedResult.resultType === 'video' ? (
                          <div className="candidate-segment-list">
                            {approvedResult.segments.map((segment, index) => (
                              <article key={`${approvedResult.id}-${index}`} className="candidate-segment">
                                <strong>{segment.heading}</strong>
                                <p>{segment.content}</p>
                              </article>
                            ))}
                          </div>
                        ) : null}

                        <p className="muted-text">通过时间：{formatDate(approvedResult.updatedAt)}</p>

                        <div className="page-actions">
                          <button className="ghost-button" type="button" onClick={() => void handleSaveResultAsAsset(approvedResult.id)} disabled={processingResultId === approvedResult.id}>
                            {processingResultId === approvedResult.id ? '保存中...' : '手动保存文本为素材'}
                          </button>
                        </div>
                      </article>
                    ) : null}

                    {reviewableResults.length === 0 ? (
                      <div className="empty-state">
                        <h3>当前没有待审核或已打回结果</h3>
                        <p>如果已经有通过结果，可以直接在上方查看；如果需要新一轮候选，请在当前任务中重新发起主链生成。</p>
                      </div>
                    ) : (
                      <div className="task-candidate-list">
                        {reviewableResults.map((result) => {
                          const isProcessing = processingResultId === result.id;
                          const reviewNote = reviewNotes[result.id] ?? '';
                          const canApprove = result.status === 'pending_review' && !isProcessing;
                          const canRegenerate = !isProcessing && selectedTask.status !== 'generating';

                          return (
                            <article key={result.id} className="candidate-card">
                              <div className="candidate-card__header">
                                <div>
                                  <p className="eyebrow">{result.resultType === 'article' ? '图文结果' : '视频结果'}</p>
                                  <h4>{result.title}</h4>
                                </div>
                                <span className="status-chip">{formatResultStatus(result.status)}</span>
                              </div>

                              <p className="candidate-body">{renderResultPreview(result)}</p>

                              {result.resultType === 'video' ? (
                                <div className="candidate-segment-list">
                                  {result.segments.map((segment, index) => (
                                    <article key={`${result.id}-${index}`} className="candidate-segment">
                                      <strong>{segment.heading}</strong>
                                      <p>{segment.content}</p>
                                    </article>
                                  ))}
                                </div>
                              ) : null}

                              <label className="form-field">
                                <span>一句审核意见</span>
                                <textarea
                                  className="form-textarea"
                                  value={reviewNote}
                                  onChange={(event) => updateReviewNote(result.id, event.target.value)}
                                  placeholder="例如：保留结构，但把语气改得更克制。"
                                  maxLength={240}
                                  disabled={isProcessing}
                                />
                              </label>

                              <div className="page-actions">
                                <button className="primary-button" type="button" onClick={() => void handleApproveResult(result.id)} disabled={!canApprove}>
                                  {isProcessing ? '处理中...' : '通过'}
                                </button>
                                <button className="danger-button" type="button" onClick={() => void handleRegenerateResult(result.id, false)} disabled={!canRegenerate}>
                                  {isProcessing ? '处理中...' : '打回重生成'}
                                </button>
                                <button className="ghost-button" type="button" onClick={() => void handleRegenerateResult(result.id, true)} disabled={!canRegenerate || !reviewNote.trim()}>
                                  {isProcessing ? '处理中...' : '基于一句意见再生成'}
                                </button>
                                <button className="ghost-button" type="button" onClick={() => void handleSaveResultAsAsset(result.id)} disabled={isProcessing}>
                                  {isProcessing ? '保存中...' : '手动保存文本为素材'}
                                </button>
                              </div>

                              <p className="muted-text">结果更新时间：{formatDate(result.updatedAt)}</p>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="page-card page-stack">
                <div className="settings-section__header">
                  <div><p className="eyebrow">Review Log</p><h3>审核动作记录</h3></div>
                </div>

                {isLoadingTaskData ? (
                  <p className="muted-text">正在读取审核动作...</p>
                ) : reviewActions.length === 0 ? (
                  <div className="empty-state">
                    <h3>当前还没有审核动作</h3>
                    <p>当你执行通过、打回重生成或手动保存文本为素材后，这里会留下最小动作记录。</p>
                  </div>
                ) : (
                  <div className="review-action-list">
                    {reviewActions.map((action) => (
                      <article key={action.id} className="review-action-card">
                        <div className="candidate-card__header">
                          <div><p className="eyebrow">Action</p><h4>{formatReviewAction(action.actionType)}</h4></div>
                          <span className="muted-text">{formatDate(action.createdAt)}</span>
                        </div>
                        <p className="muted-text">关联结果：{action.resultId}</p>
                        {action.note ? <p className="candidate-body">{action.note}</p> : null}
                        {action.relatedAssetId ? <p className="muted-text">关联素材：{assetNameMap.get(action.relatedAssetId) ?? action.relatedAssetId}</p> : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
