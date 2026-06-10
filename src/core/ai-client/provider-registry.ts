// 按 (provider, key, model) 缓存 Vercel AI SDK 的 LanguageModel 实例。
// 国产三家 → @ai-sdk/openai-compatible;Claude → @ai-sdk/anthropic(官方,非套壳)。

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { PROVIDERS, type ProviderId } from "./config";

const cache = new Map<string, LanguageModel>();

/** 解析实际使用的模型名:显式覆盖 > 环境变量 > 默认。 */
export function resolveModelName(id: ProviderId, override?: string): string {
  const cfg = PROVIDERS[id];
  const fromEnv = cfg.envModel ? process.env[cfg.envModel] : undefined;
  return override ?? fromEnv ?? cfg.defaultModel;
}

function resolveBaseURL(id: ProviderId): string | undefined {
  const cfg = PROVIDERS[id];
  if (cfg.kind !== "openai-compatible") return undefined;
  const fromEnv = cfg.envBaseUrl ? process.env[cfg.envBaseUrl] : undefined;
  return fromEnv ?? cfg.baseURL;
}

export function getModel(id: ProviderId, apiKey: string, modelOverride?: string): LanguageModel {
  const modelName = resolveModelName(id, modelOverride);
  const cacheKey = `${id}:${apiKey}:${modelName}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const cfg = PROVIDERS[id];
  let model: LanguageModel;
  if (cfg.kind === "anthropic") {
    model = createAnthropic({ apiKey })(modelName);
  } else {
    const baseURL = resolveBaseURL(id);
    if (!baseURL) throw new Error(`Provider ${id} 缺少 baseURL`);
    model = createOpenAICompatible({ name: id, baseURL, apiKey })(modelName);
  }
  cache.set(cacheKey, model);
  return model;
}
