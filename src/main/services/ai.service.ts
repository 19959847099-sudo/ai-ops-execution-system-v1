import { z } from 'zod';
import type { AssetRecord } from '../../shared/types/asset';
import type {
  ArticleTaskCandidateRecord,
  TaskCandidateSegment,
  TaskForm,
  VideoTaskCandidateRecord,
} from '../../shared/types/task';
import type { TaskPreparationMemorySnapshot } from '../../shared/types/memory';
import { SettingsService } from './settings.service';

type TaskGenerationContext = {
  taskId: string;
  title: string;
  goal: string;
  taskForm: TaskForm;
  supplementalRequirements: string;
  memorySnapshot: TaskPreparationMemorySnapshot;
  assets: AssetRecord[];
};

type GeneratedArticleCandidate = Pick<ArticleTaskCandidateRecord, 'candidateType' | 'title' | 'body'>;
type GeneratedVideoCandidate = Pick<
  VideoTaskCandidateRecord,
  'candidateType' | 'title' | 'structuredDescription' | 'segments'
>;

type GeneratedTaskCandidate = GeneratedArticleCandidate | GeneratedVideoCandidate;

const articleCandidateResponseSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1),
    }),
  ).min(2).max(3),
});

const videoCandidateResponseSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string().trim().min(1).max(200),
      structuredDescription: z.string().trim().min(1),
      segments: z.array(
        z.object({
          heading: z.string().trim().min(1).max(120),
          content: z.string().trim().min(1).max(1000),
        }),
      ).min(1).max(12),
    }),
  ).min(2).max(3),
});

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export class AiService {
  constructor(private readonly settingsService: SettingsService) {}

  async generateTaskCandidates(context: TaskGenerationContext): Promise<GeneratedTaskCandidate[]> {
    const settings = this.settingsService.getSystemSettings();

    if (!settings.apiKey) {
      throw new Error('当前 API Key 为空，无法生成候选。');
    }

    const endpoint = `${settings.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.modelName,
        temperature: 0.7,
        stream: false,
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt(context.taskForm),
          },
          {
            role: 'user',
            content: this.buildUserPrompt(context),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = this.readMessageContent(payload);
    const parsed = this.parseJsonPayload(content);

    if (context.taskForm === 'article') {
      const result = articleCandidateResponseSchema.parse(parsed);
      return result.candidates.map((candidate) => ({
        candidateType: 'article',
        title: candidate.title,
        body: candidate.body,
      }));
    }

    const result = videoCandidateResponseSchema.parse(parsed);
    return result.candidates.map((candidate) => ({
      candidateType: 'video',
      title: candidate.title,
      structuredDescription: candidate.structuredDescription,
      segments: candidate.segments as TaskCandidateSegment[],
    }));
  }

  private buildSystemPrompt(taskForm: TaskForm): string {
    if (taskForm === 'article') {
      return [
        '你是 AI 运营执行系统 V1 的主链候选生成器。',
        '你的任务是基于给定任务信息、常驻记忆与素材摘要，输出 2 到 3 个图文候选。',
        '必须只输出 JSON，不要输出解释、Markdown 或代码块。',
        'JSON 结构固定为 {"candidates":[{"title":"...","body":"..."}]}。',
      ].join('\n');
    }

    return [
      '你是 AI 运营执行系统 V1 的主链候选生成器。',
      '你的任务是基于给定任务信息、常驻记忆与素材摘要，输出 2 到 3 个视频候选包。',
      '必须只输出 JSON，不要输出解释、Markdown 或代码块。',
      'JSON 结构固定为 {"candidates":[{"title":"...","structuredDescription":"...","segments":[{"heading":"...","content":"..."}]}]}。',
      'segments 表示分镜或段落级结构，只允许文字结构化说明，不要涉及剪辑时间轴、TTS、BGM。',
    ].join('\n');
  }

  private buildUserPrompt(context: TaskGenerationContext): string {
    const assetLines =
      context.assets.length === 0
        ? ['- 当前任务未挂接素材。']
        : context.assets.map((asset, index) => {
            if (asset.assetType === 'text') {
              const preview = (asset.textContent ?? '').slice(0, 400);
              return [
                `- 素材 ${index + 1}`,
                `  - 名称: ${asset.displayName}`,
                `  - 类型: text`,
                `  - 文本摘录: ${preview || '无'}`,
              ].join('\n');
            }

            return [
              `- 素材 ${index + 1}`,
              `  - 名称: ${asset.displayName}`,
              `  - 类型: ${asset.assetType}`,
              `  - 文件名: ${asset.fileName}`,
            ].join('\n');
          });

    return [
      '请基于以下上下文生成候选：',
      '',
      '一、任务信息',
      `- 主题: ${context.title}`,
      `- 目标: ${context.goal}`,
      `- 形式: ${context.taskForm === 'article' ? '图文' : '视频'}`,
      `- 补充要求: ${context.supplementalRequirements || '无'}`,
      '',
      '二、项目常驻记忆',
      `- 一句话定义: ${context.memorySnapshot.projectResidentMemory.oneLineDefinition || '无'}`,
      `- 目标用户: ${context.memorySnapshot.projectResidentMemory.targetAudience || '无'}`,
      `- 核心价值: ${context.memorySnapshot.projectResidentMemory.coreValue || '无'}`,
      `- 当前重点: ${context.memorySnapshot.projectResidentMemory.currentFocus || '无'}`,
      `- 禁止表达: ${context.memorySnapshot.projectResidentMemory.forbiddenExpressions || '无'}`,
      `- 固定约束: ${context.memorySnapshot.projectResidentMemory.fixedConstraints || '无'}`,
      '',
      '三、用户偏好常驻记忆',
      `- 产品偏好: ${context.memorySnapshot.userResidentMemory.productPreference || '无'}`,
      `- 表达偏好: ${context.memorySnapshot.userResidentMemory.expressionPreference || '无'}`,
      `- 设计偏好: ${context.memorySnapshot.userResidentMemory.designPreference || '无'}`,
      `- 开发偏好: ${context.memorySnapshot.userResidentMemory.developmentPreference || '无'}`,
      `- 成本偏好: ${context.memorySnapshot.userResidentMemory.costPreference || '无'}`,
      '',
      '四、当前任务挂接素材摘要',
      ...assetLines,
      '',
      context.taskForm === 'article'
        ? '请返回 3 个图文候选，标题风格要清晰区分，正文直接给出可阅读成稿。'
        : '请返回 3 个视频候选，必须是结构化视频候选包，每个候选都要给出结构化说明与分镜或段落级结构。',
    ].join('\n');
  }

  private readMessageContent(payload: ChatCompletionResponse): string {
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const merged = content
        .map((item) => item.text ?? '')
        .join('')
        .trim();
      if (merged) {
        return merged;
      }
    }

    throw new Error('模型没有返回可解析的候选内容。');
  }

  private parseJsonPayload(content: string): unknown {
    const trimmed = content.trim();

    try {
      return JSON.parse(trimmed);
    } catch {
      const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch?.[1]) {
        return JSON.parse(fencedMatch[1]);
      }
    }

    throw new Error('模型返回内容不是合法 JSON，无法承接为候选。');
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const payload = (await response.json()) as { error?: { message?: string }; message?: string };
      const message = payload.error?.message || payload.message;

      if (message) {
        return message;
      }
    } catch {
      const fallback = await response.text().catch(() => '');
      if (fallback) {
        return fallback.slice(0, 200);
      }
    }

    return `候选生成失败（HTTP ${response.status}）。`;
  }
}
