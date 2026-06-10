// AI 客户端配置:模型/超时/重试/熔断/并发等常量集中一处(避免散落硬编码)。
// model 名与 baseURL 均可经环境变量覆盖(见各 envModel/envBaseUrl)。

export type ProviderKind = "openai-compatible" | "anthropic";
export type ProviderId = "deepseek" | "minimax" | "moonshot" | "anthropic";

export interface ProviderConfig {
  id: ProviderId;
  kind: ProviderKind;
  envApiKey: string; // API Key 环境变量名(值可逗号分隔多 Key,组成 Key 池)
  baseURL?: string; // openai-compatible 用;anthropic 走官方默认
  envBaseUrl?: string; // baseURL 覆盖的环境变量名
  defaultModel: string; // 默认模型名(可被 envModel 覆盖)
  envModel?: string;
}

// Provider 注册表。国产三家走 OpenAI 兼容接口;Claude 走官方 anthropic provider。
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  deepseek: {
    id: "deepseek",
    kind: "openai-compatible",
    envApiKey: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com",
    envBaseUrl: "DEEPSEEK_BASE_URL",
    defaultModel: "deepseek-v4-flash", // 新默认(旧 deepseek-chat 2026/07/24 弃用);可经 DEEPSEEK_MODEL 覆盖
    envModel: "DEEPSEEK_MODEL",
  },
  minimax: {
    id: "minimax",
    kind: "openai-compatible",
    envApiKey: "MINIMAX_API_KEY",
    baseURL: "https://api.minimaxi.com/v1",
    envBaseUrl: "MINIMAX_BASE_URL",
    defaultModel: "MiniMax-Text-01",
    envModel: "MINIMAX_MODEL",
  },
  moonshot: {
    id: "moonshot",
    kind: "openai-compatible",
    envApiKey: "MOONSHOT_API_KEY",
    baseURL: "https://api.moonshot.cn/v1",
    envBaseUrl: "MOONSHOT_BASE_URL",
    defaultModel: "kimi-k2-0905-preview",
    envModel: "MOONSHOT_MODEL",
  },
  anthropic: {
    id: "anthropic",
    kind: "anthropic",
    envApiKey: "ANTHROPIC_API_KEY",
    envBaseUrl: "ANTHROPIC_BASE_URL", // 支持中转站(如 Vectrust);留空用官方端点
    defaultModel: "claude-sonnet-4-6",
    envModel: "ANTHROPIC_MODEL",
  },
};

// 国产三家降级顺序(关键路径分散 + 失败降级)。
export const FALLBACK_CHAIN: ProviderId[] = ["deepseek", "minimax", "moonshot"];

// 超时(毫秒)。沿用旧库经验值。
export const TIMEOUTS = {
  callMs: 30_000, // 单次调用默认超时
  agentMs: 70_000, // 单个 Agent 预算上限
  arbitratorMs: 95_000, // 仲裁员预算上限
};

// 重试与退避。
export const RETRY = {
  maxRetries: 1, // 同模型最多重试次数
  retryDelayMs: 1_000,
  rateLimitWaitCapMs: 2_000, // 429/503 短等上限
};

// 熔断:连续失败阈值 + 冷却时长。
export const CIRCUIT = {
  failureThreshold: 2,
  cooldownMs: 5 * 60 * 1_000,
};

// 并发信号量:high=主(Agent),low=后台(如跨域/记忆)。
export const SEMAPHORE = {
  high: 3,
  low: 1,
};

export const MAX_PROMPT_LENGTH = 100_000; // 超长 prompt 截断阈值
export const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;

// 降级链首选时间预算占比(其余备选平分剩余)。
export const PRIMARY_BUDGET_RATIO = 0.7;

// ==================== 模型档位:按任务复杂度派模型 ====================
// fast=简单活(关键词/翻译/引擎选择);standard=中等(重排/L1·L2 分析);strong=复杂(辩论/仲裁)。
// 各档可经环境变量覆盖,集中一处管理。
export type ModelTier = "fast" | "standard" | "strong";

export interface TierSpec {
  provider: ProviderId;
  model?: string; // 留空时用该 provider 的默认(envModel/defaultModel)
}

export function resolveTier(tier: ModelTier): TierSpec {
  switch (tier) {
    case "fast":
      // 非思考模型:简单活要正文直出。v4-flash/v4-pro 是思考模型,小输出会被 reasoning 吃光正文。
      // deepseek-chat = v4-flash 的非思考模式(2026/07/24 前迁移到 v4-flash 非思考参数)。
      return { provider: "deepseek", model: process.env.TIER_FAST_MODEL ?? "deepseek-chat" };
    case "standard":
      return { provider: "deepseek", model: process.env.TIER_STANDARD_MODEL ?? "deepseek-v4-pro" };
    case "strong":
      // anthropic(中转站 claude-opus-4-7-thinking,经 ANTHROPIC_MODEL);可用 TIER_STRONG_* 覆盖
      return {
        provider: (process.env.TIER_STRONG_PROVIDER as ProviderId) ?? "anthropic",
        model: process.env.TIER_STRONG_MODEL,
      };
  }
}
