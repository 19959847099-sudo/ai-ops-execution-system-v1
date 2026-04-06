import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ProjectRecord } from '@shared/types/project';
import type { ResultRecord, ResultStatus } from '@shared/types/result';
import type { TaskRecord } from '@shared/types/task';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatResultStatus(status: ResultStatus): string {
  if (status === 'approved') {
    return '已通过';
  }

  if (status === 'rejected') {
    return '已打回';
  }

  return '待审核';
}

function extractPreview(result: ResultRecord): string {
  if (result.resultType === 'article') {
    return result.body.slice(0, 160);
  }

  return result.structuredDescription.slice(0, 160);
}

export function ProjectResultsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taskTitleMap = useMemo(
    () => new Map(tasks.map((task) => [task.id, task.title])),
    [tasks],
  );

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
        const [projectRecord, taskRecords, resultRecords] = await Promise.all([
          window.projectApi.getProjectById(projectId),
          window.taskApi.listTasks(projectId),
          window.resultApi.listProjectResults(projectId),
        ]);

        if (!disposed) {
          setProject(projectRecord);
          setTasks(taskRecords);
          setResults(resultRecords);
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
        <p className="eyebrow">Stage 5-2</p>
        <h2>正在读取项目结果...</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-card page-stack">
        <p className="eyebrow">Stage 5-2</p>
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
        <p className="eyebrow">Stage 5-2</p>
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
            <p className="eyebrow">Stage 5-2</p>
            <h2>{project.name} 的结果回看</h2>
            <p className="page-helper">
              这里仅做项目内结果最小回看与跳转，不扩展成综合分析后台，也不承接自动回流与临时记忆管理。
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
        </div>

        {results.length === 0 ? (
          <div className="empty-state">
            <h3>当前还没有结果</h3>
            <p>先进入任务审核页生成并审核候选，结果层成立后这里才会出现回看记录。</p>
          </div>
        ) : (
          <div className="task-candidate-list">
            {results.map((result) => (
              <article key={result.id} className="candidate-card">
                <div className="candidate-card__header">
                  <div>
                    <p className="eyebrow">{result.resultType === 'article' ? '图文结果' : '视频结果'}</p>
                    <h4>{result.title}</h4>
                  </div>
                  <span className="status-chip">{formatResultStatus(result.status)}</span>
                </div>
                <p className="candidate-body">{extractPreview(result) || '暂无摘要'}</p>
                <p className="muted-text">所属任务：{taskTitleMap.get(result.taskId) ?? result.taskId}</p>
                <p className="muted-text">更新时间：{formatDate(result.updatedAt)}</p>
                <div className="page-actions">
                  <Link
                    className="ghost-button link-button"
                    to={`/projects/${project.id}/tasks?taskId=${result.taskId}`}
                  >
                    进入任务审核页
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
