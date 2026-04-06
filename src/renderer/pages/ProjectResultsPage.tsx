import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RecentTemporaryMemoryRecord } from '@shared/types/memory';
import type { ProjectRecord } from '@shared/types/project';
import type { ResultAutoFeedbackRecord, ResultRecord, ResultStatus } from '@shared/types/result';
import type { TaskLoopStatus, TaskRecord } from '@shared/types/task';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatResultStatus(status: ResultStatus): string {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已打回';
  return '待审核';
}

function formatLoopStatus(status: TaskLoopStatus): string {
  if (status === 'completed') return '闭环已完成';
  if (status === 'failed') return '闭环失败';
  return '闭环待完成';
}

function extractPreview(result: ResultRecord): string {
  if (result.resultType === 'article') return result.body.slice(0, 160);
  return result.structuredDescription.slice(0, 160);
}

function getStatusChipClass(status: TaskLoopStatus | ResultAutoFeedbackRecord['status']): string {
  if (status === 'completed') return 'status-chip is-active';
  if (status === 'failed') return 'status-chip is-danger';
  return 'status-chip';
}

export function ProjectResultsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [autoFeedbacks, setAutoFeedbacks] = useState<ResultAutoFeedbackRecord[]>([]);
  const [recentMemories, setRecentMemories] = useState<RecentTemporaryMemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const feedbackCountByResult = useMemo(() => {
    const map = new Map<string, number>();
    autoFeedbacks.forEach((feedback) => {
      map.set(feedback.resultId, (map.get(feedback.resultId) ?? 0) + 1);
    });
    return map;
  }, [autoFeedbacks]);
  const failedFeedbackCountByResult = useMemo(() => {
    const map = new Map<string, number>();
    autoFeedbacks.forEach((feedback) => {
      if (feedback.status === 'failed') {
        map.set(feedback.resultId, (map.get(feedback.resultId) ?? 0) + 1);
      }
    });
    return map;
  }, [autoFeedbacks]);
  const recentMemoryCountByTask = useMemo(() => {
    const map = new Map<string, number>();
    recentMemories.forEach((memory) => {
      map.set(memory.taskId, (map.get(memory.taskId) ?? 0) + 1);
    });
    return map;
  }, [recentMemories]);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [projectRecord, taskRecords, resultRecords, feedbackRecords, memoryRecords] = await Promise.all([
          window.projectApi.getProjectById(projectId),
          window.taskApi.listTasks(projectId),
          window.resultApi.listProjectResults(projectId),
          window.resultApi.listProjectAutoFeedbacks(projectId),
          window.memoryApi.listRecentTemporaryMemories(projectId),
        ]);

        if (!disposed) {
          setProject(projectRecord);
          setTasks(taskRecords);
          setResults(resultRecords);
          setAutoFeedbacks(feedbackRecords);
          setRecentMemories(memoryRecords);
        }
      } catch (nextError) {
        if (!disposed) {
          setError(nextError instanceof Error ? nextError.message : '项目结果页读取失败。');
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 6-2</p>
        <h2>正在读取项目结果...</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 6-2</p>
        <h2>项目结果读取失败</h2>
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
        <p className="eyebrow">Stage 6-2</p>
        <h2>项目不存在</h2>
        <p className="muted-text">未找到项目，请返回项目列表重新选择。</p>
        <Link className="ghost-button link-button" to="/">
          返回项目列表
        </Link>
      </section>
    );
  }

  return (
    <section className="page-stack asset-library-layout">
      <div className="page-card page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Stage 6-2</p>
            <h2>{project.name} 的结果回看</h2>
            <p className="page-helper">
              这里继续只做项目内结果回看，同时补充阶段 6 的最小闭环状态信息，不扩展成综合分析后台。
            </p>
          </div>
          <div className="project-home-actions">
            <Link className="ghost-button link-button" to={`/projects/${project.id}`}>
              返回项目主页
            </Link>
          </div>
        </div>
      </div>

      <section className="page-card page-stack">
        <div className="settings-section__header">
          <div>
            <p className="eyebrow">Results</p>
            <h3>项目内结果列表</h3>
          </div>
          <span className="muted-text">当前共 {results.length} 条结果</span>
        </div>

        {results.length === 0 ? (
          <div className="empty-state">
            <h3>当前还没有结果</h3>
            <p>先进入任务审核页生成并通过结果，结果层成立后这里才会出现回看记录。</p>
          </div>
        ) : (
          <div className="task-candidate-list">
            {results.map((result) => {
              const task = taskMap.get(result.taskId);
              const feedbackCount = feedbackCountByResult.get(result.id) ?? 0;
              const failedFeedbackCount = failedFeedbackCountByResult.get(result.id) ?? 0;
              const recentMemoryCount = recentMemoryCountByTask.get(result.taskId) ?? 0;

              return (
                <article key={result.id} className="candidate-card">
                  <div className="candidate-card__header">
                    <div>
                      <p className="eyebrow">{result.resultType === 'article' ? '图文结果' : '视频结果'}</p>
                      <h4>{result.title}</h4>
                    </div>
                    <span className="status-chip">{formatResultStatus(result.status)}</span>
                  </div>

                  {result.coverText ? <p className="candidate-cover">封面文案：{result.coverText}</p> : null}
                  <p className="candidate-body">{extractPreview(result) || '暂无摘要'}</p>

                  <div className="detail-grid">
                    <div><dt>所属任务</dt><dd>{task?.title ?? result.taskId}</dd></div>
                    <div><dt>任务闭环</dt><dd>{task ? formatLoopStatus(task.loopStatus) : '暂无'}</dd></div>
                    <div><dt>自动回流记录</dt><dd>{feedbackCount} 条</dd></div>
                    <div><dt>最近临时记忆</dt><dd>{recentMemoryCount} 条</dd></div>
                  </div>

                  {task ? (
                    <div className="page-actions">
                      <span className={getStatusChipClass(task.loopStatus)}>{formatLoopStatus(task.loopStatus)}</span>
                      {failedFeedbackCount > 0 ? <span className="status-chip is-danger">有 {failedFeedbackCount} 条闭环失败</span> : null}
                    </div>
                  ) : null}

                  <p className="muted-text">更新时间：{formatDate(result.updatedAt)}</p>

                  <div className="page-actions">
                    <Link className="ghost-button link-button" to={`/projects/${project.id}/tasks?taskId=${result.taskId}`}>
                      进入任务审核页
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
