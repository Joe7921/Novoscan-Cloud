// 核心调用:统一的 AI 调用入口,叠加 Key 池 / 信号量 / 超时+中断 / 同模型重试 /
// 限流退避 / 熔断 / 成本占位 / 降级链。参考旧库 ai-client 的 callAIRaw/callAIWithFallback。

import { generateText, type ModelMessage } from "ai";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  FALLBACK_CHAIN,
  MAX_PROMPT_LENGTH,
  RETRY,
  TIMEOUTS,
  resolveTier,
  type ModelTier,
  type ProviderId,
} from "./config";
import { isCircuitOpen, recordFailure, recordSuccess } from "./circuit-breaker";
import { acquireKey, hasKey } from "./key-pool";
import { getModel, resolveModelName } from "./provider-registry";
import { withSemaphore, type Priority } from "./semaphore";

// providerOptions 复用 generateText 的入参类型,避免猜错形状(如 anthropic thinking)。
type ProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

/** 多模态图片输入(vision 调用用)。 */
export interface VisionImage {
  /** 图片数据:base64 字符串或字节数组(Vercel AI SDK 接受二者) */
  data: string | Uint8Array;
  /** MIME 类型,如 "image/png" / "image/jpeg" / "image/webp" */
  mediaType: string;
}

export interface CallOptions {
  prompt: string;
  provider: ProviderId;
  model?: string; // 覆盖默认模型名
  priority?: Priority; // 默认 high
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  providerOptions?: ProviderOptions; // 透传给底层(如 { anthropic: { ... } })
  /** 多模态图片:传入时改用 messages(text + image parts),仅多模态 provider(anthropic)支持 */
  images?: VisionImage[];
}

export interface AIResult {
  text: string;
  usedProvider: ProviderId;
  usedModel: string;
  usedKeyLabel: string; // 命中的 key 备注标签(日志用,非完整 key)
}

/** provider 是否可用(已配置 Key)。 */
export function isProviderAvailable(id: ProviderId): boolean {
  return hasKey(id);
}

/** 成本限制占位:后期接 Supabase 计量,当前恒放行。 */
export async function checkCostLimit(
  _provider: ProviderId,
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true };
}

function isRateLimit(err: unknown): boolean {
  const code = (err as { statusCode?: number })?.statusCode;
  if (code === 429 || code === 503) return true;
  const name = (err as { name?: string })?.name ?? "";
  return /rate.?limit|overloaded/i.test(name);
}

// 把 prompt + 图片拼成单条 user message(text part 在前,image parts 随后)。
function buildVisionMessages(prompt: string, images: VisionImage[]): ModelMessage[] {
  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...images.map((img) => ({
          type: "image" as const,
          image: img.data,
          mediaType: img.mediaType,
        })),
      ],
    },
  ];
}

// 合成"超时 + 外部中断"的 AbortSignal。
function makeSignal(timeoutMs: number, external?: AbortSignal) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  if (external) {
    if (external.aborted) ctrl.abort();
    else external.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cleanup() {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
  };
}

/** 单 provider 调用(Key 池 + 信号量 + 超时 + 同模型重试 + 熔断记录)。 */
export async function callAI(opts: CallOptions): Promise<AIResult> {
  const { provider } = opts;
  if (!hasKey(provider)) {
    throw new Error(`Provider ${provider} 未配置 API Key`);
  }
  const cost = await checkCostLimit(provider);
  if (!cost.allowed) throw new Error(cost.reason ?? "成本超限");

  const prompt =
    opts.prompt.length > MAX_PROMPT_LENGTH ? opts.prompt.slice(0, MAX_PROMPT_LENGTH) : opts.prompt;
  const timeoutMs = opts.timeoutMs ?? TIMEOUTS.callMs;
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const priority = opts.priority ?? "high";

  return withSemaphore(priority, async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY.maxRetries; attempt++) {
      const handle = acquireKey(provider);
      const model = getModel(provider, handle.key, opts.model);
      const { signal, cleanup } = makeSignal(timeoutMs, opts.abortSignal);
      try {
        // 有图片走 messages(text + image parts);否则保留已验证的 prompt 路径不变。
        const inputArg =
          opts.images && opts.images.length > 0
            ? { messages: buildVisionMessages(prompt, opts.images) }
            : { prompt };
        const result = await generateText({
          model,
          ...inputArg,
          maxOutputTokens,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          ...(opts.providerOptions ? { providerOptions: opts.providerOptions } : {}),
          abortSignal: signal,
        });
        cleanup();
        handle.release();
        recordSuccess(provider);
        return {
          text: result.text,
          usedProvider: provider,
          usedModel: resolveModelName(provider, opts.model),
          usedKeyLabel: handle.label,
        };
      } catch (err) {
        cleanup();
        handle.markFailure();
        handle.release();
        lastErr = err;
        // 失败日志显示 provider + key 标签(便于排查是哪把 key),绝不打印完整 key。
        console.warn(
          `[ai-client] ${provider}[${handle.label}] 调用失败: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (isRateLimit(err)) break; // 限流:不在同模型重试,交给降级链
        if (attempt < RETRY.maxRetries) {
          await new Promise((r) => setTimeout(r, RETRY.retryDelayMs));
        }
      }
    }
    recordFailure(provider);
    throw lastErr;
  });
}

/**
 * 多模态调用(图片理解)。固定走多模态 provider(默认 anthropic),
 * **不接文本降级链**——国产分档模型不支持看图,降级只会必然失败。
 * 仅做单 provider + 同模型重试(callAI 内置)。
 */
export function callVision(
  opts: Omit<CallOptions, "provider"> & { provider?: ProviderId },
): Promise<AIResult> {
  return callAI({ ...opts, provider: opts.provider ?? "anthropic" });
}

/** 带降级链的调用:首选失败/熔断时依次降级。anthropic 可降级到国产链。 */
export async function callWithFallback(opts: CallOptions): Promise<AIResult> {
  const order: ProviderId[] =
    opts.provider === "anthropic"
      ? ["anthropic", ...FALLBACK_CHAIN]
      : [opts.provider, ...FALLBACK_CHAIN.filter((p) => p !== opts.provider)];

  let lastErr: unknown;
  for (const provider of order) {
    if (!isProviderAvailable(provider) || isCircuitOpen(provider)) continue;
    try {
      // 降级到非首选时用该 provider 默认模型(忽略 model 覆盖)。
      const model = provider === opts.provider ? opts.model : undefined;
      return await callAI({ ...opts, provider, model });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("无可用 provider(检查 API Key 与熔断状态)");
}

/** 按档位调用(fast/standard/strong):自动解析 provider+model,带降级链。 */
export function callByTier(
  tier: ModelTier,
  opts: Omit<CallOptions, "provider" | "model">,
): Promise<AIResult> {
  const spec = resolveTier(tier);
  return callWithFallback({ ...opts, provider: spec.provider, model: spec.model });
}
