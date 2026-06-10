// 证据闸门:相关性重排 + 过滤——治"垃圾进垃圾出"的核心。
// 把检索召回的候选,按"与用户创意的真实相关性"打分,砍掉低相关、按分排序,
// 只把高相关证据喂给下游 Agent。有国产 Key 用 LLM 打分,否则规则兜底。

import { callWithFallback, isProviderAvailable, parseAgentJSON } from "@/core/ai-client";
import type { AcademicPaper } from "@/lib/types";

export interface RerankedResult {
  paper: AcademicPaper;
  relevance: number; // 0-100
}

export interface RerankOptions {
  minRelevance?: number; // 低于此分丢弃
}

function hasAIKey(): boolean {
  return (
    isProviderAvailable("deepseek") ||
    isProviderAvailable("minimax") ||
    isProviderAvailable("moonshot")
  );
}

function tokenize(text: string): string[] {
  return [...text.toLowerCase().matchAll(/[一-龥]{2,}|[a-z][a-z0-9.+-]+/g)].map((m) => m[0]);
}

// 规则打分(0-100):关键词命中 60 + 引用 20 + 时近 15 + 开放 5。
function ruleScore(query: string, p: AcademicPaper): number {
  const terms = tokenize(query);
  const text = `${p.title ?? ""} ${p.description ?? ""}`.toLowerCase();
  const hitRatio = terms.length ? terms.filter((t) => text.includes(t)).length / terms.length : 0;
  const hitScore = hitRatio * 60;
  const citeScore = Math.min(20, Math.log10((p.citationCount ?? 0) + 1) * 7);
  const yearScore = !p.year ? 0 : p.year >= 2022 ? 15 : p.year >= 2019 ? 8 : 3;
  const oaScore = p.isOpenAccess || p.pdfUrl ? 5 : 0;
  return Math.round(hitScore + citeScore + yearScore + oaScore);
}

// LLM 批量打分:一次调用给每条候选打相关性分。
async function llmScores(query: string, papers: AcademicPaper[]): Promise<number[]> {
  const list = papers
    .map((p, i) => `[${i}] ${p.title ?? "(无题)"}${p.description ? ` — ${p.description.slice(0, 160)}` : ""}`)
    .join("\n");
  const r = await callWithFallback({
    provider: "deepseek",
    prompt:
      `用户创意:\n"""${query}"""\n\n下面是检索到的候选论文。请判断每一条与该创意的"相关性",` +
      `打 0-100 分(越相关越高,完全无关给 0)。只输出 JSON 数组,形如 [{"i":0,"score":85}],不要任何解释:\n\n${list}`,
    maxOutputTokens: Math.min(4000, papers.length * 30 + 200),
    temperature: 0,
    timeoutMs: 30_000,
  });
  const parsed = parseAgentJSON<unknown>(r.text);
  const map = new Map<number, number>();
  if (Array.isArray(parsed)) {
    for (const it of parsed as Array<{ i?: number; score?: number }>) {
      if (typeof it?.i === "number") {
        map.set(it.i, Math.max(0, Math.min(100, Number(it.score) || 0)));
      }
    }
  }
  return papers.map((_, i) => map.get(i) ?? 0);
}

/** 相关性重排 + 过滤。返回按相关性降序、已剔除低相关的结果。 */
export async function rerankAcademic(
  query: string,
  papers: AcademicPaper[],
  opts: RerankOptions = {},
): Promise<RerankedResult[]> {
  if (papers.length === 0) return [];
  const useLLM = hasAIKey();
  // 无 AI key:规则无跨语言语义判断,退化为"只排序不过滤"(避免误杀);
  // 治"垃圾进"的真正过滤由 LLM 重排承担(配国产 key 后自动启用)。
  const minRelevance = opts.minRelevance ?? (useLLM ? 40 : 0);

  let scores: number[];
  if (useLLM) {
    try {
      scores = await llmScores(query, papers);
    } catch {
      scores = papers.map((p) => ruleScore(query, p));
    }
  } else {
    scores = papers.map((p) => ruleScore(query, p));
  }

  return papers
    .map((paper, i) => ({ paper, relevance: scores[i] ?? 0 }))
    .filter((r) => r.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance);
}
