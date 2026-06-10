// 引擎选择:AI(fast 档)决定用哪些网页搜索引擎 + 是否需要学术引擎。
// 无 key 或失败时走规则 fallback。参考旧库 search/engine-selector.ts。

import { callByTier, isProviderAvailable, parseAgentJSON } from "@/core/ai-client";
import type { SerpEngine } from "./industry/serpapi";

export interface EngineSelection {
  serpEngines: SerpEngine[]; // 最多 2 个
  useScholar: boolean;
  reasoning: string;
  method: "ai" | "fallback";
}

const VALID: SerpEngine[] = ["google", "baidu", "bing", "duckduckgo"];

function hasAIKey(): boolean {
  return (
    isProviderAvailable("deepseek") ||
    isProviderAvailable("minimax") ||
    isProviderAvailable("moonshot")
  );
}

function containsChinese(text: string): boolean {
  return /[一-龥]/.test(text);
}

function fallbackSelection(query: string): EngineSelection {
  const zh = containsChinese(query);
  const academic = /research|paper|study|algorithm|model|学术|论文|算法|模型|研究/i.test(query);
  return {
    serpEngines: zh ? ["baidu", "google"] : ["google"],
    useScholar: academic,
    reasoning: zh ? "中文 → 百度 + 谷歌双覆盖" : "英文 → 谷歌主力",
    method: "fallback",
  };
}

export async function selectEngines(query: string): Promise<EngineSelection> {
  if (!hasAIKey()) return fallbackSelection(query);
  try {
    const r = await callByTier("fast", {
      prompt:
        `为下面的检索需求选择最合适的网页搜索引擎(从 google/baidu/bing/duckduckgo 中选最多 2 个),` +
        `并判断是否需要学术引擎。只输出 JSON {"engines":["google"],"scholar":true,"reason":"..."},不要解释:\n\n${query}`,
      maxOutputTokens: 150,
      temperature: 0,
      timeoutMs: 15_000,
    });
    const p = parseAgentJSON<{ engines?: string[]; scholar?: boolean; reason?: string }>(r.text);
    const engines = (p.engines ?? [])
      .filter((e): e is SerpEngine => VALID.includes(e as SerpEngine))
      .slice(0, 2);
    return {
      serpEngines: engines.length ? engines : ["google"],
      useScholar: !!p.scholar,
      reasoning: p.reason ?? "",
      method: "ai",
    };
  } catch {
    return fallbackSelection(query);
  }
}
