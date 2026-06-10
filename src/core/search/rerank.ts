// 证据闸门:相关性重排 + 过滤——治"垃圾进垃圾出"的核心(学术 / 网页通用)。
// 把召回的候选按"与用户创意的真实相关性"打分,砍低相关、按分排序。
// 有国产 key 用 LLM 跨语言打分,否则规则兜底(仅排序不过滤,避免误杀)。

import { callByTier, isProviderAvailable, parseAgentJSON } from "@/core/ai-client";
import type { AcademicPaper, GithubRepo, WebResult } from "@/lib/types";

export interface RerankOptions {
  minRelevance?: number;
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

function keywordHitScore(query: string, text: string): number {
  const terms = tokenize(query);
  if (!terms.length) return 0;
  const lower = text.toLowerCase();
  return (terms.filter((t) => lower.includes(t)).length / terms.length) * 60;
}

interface ScoreItem {
  title?: string;
  snippet?: string;
}

// LLM 批量打分:一次调用给每条候选打 0-100 相关性分。
async function llmScores(query: string, items: ScoreItem[]): Promise<number[]> {
  const list = items
    .map((it, i) => `[${i}] ${it.title ?? "(无题)"}${it.snippet ? ` — ${it.snippet.slice(0, 160)}` : ""}`)
    .join("\n");
  const r = await callByTier("fast", {
    prompt:
      `用户创意:\n"""${query}"""\n\n下面是检索到的候选资料。请判断每一条与该创意的"相关性",` +
      `打 0-100 分(越相关越高,完全无关给 0)。只输出 JSON 数组,形如 [{"i":0,"score":85}],不要任何解释:\n\n${list}`,
    maxOutputTokens: Math.min(4000, items.length * 30 + 200),
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
  return items.map((_, i) => map.get(i) ?? 0);
}

// ==================== 学术 ====================

export interface RerankedResult {
  paper: AcademicPaper;
  relevance: number;
}

function academicRuleScore(query: string, p: AcademicPaper): number {
  const hit = keywordHitScore(query, `${p.title ?? ""} ${p.description ?? ""}`);
  const cite = Math.min(20, Math.log10((p.citationCount ?? 0) + 1) * 7);
  const year = !p.year ? 0 : p.year >= 2022 ? 15 : p.year >= 2019 ? 8 : 3;
  const oa = p.isOpenAccess || p.pdfUrl ? 5 : 0;
  return Math.round(hit + cite + year + oa);
}

export async function rerankAcademic(
  query: string,
  papers: AcademicPaper[],
  opts: RerankOptions = {},
): Promise<RerankedResult[]> {
  if (papers.length === 0) return [];
  const useLLM = hasAIKey();
  const minRelevance = opts.minRelevance ?? (useLLM ? 40 : 0);
  let scores: number[];
  if (useLLM) {
    try {
      scores = await llmScores(query, papers.map((p) => ({ title: p.title, snippet: p.description })));
    } catch {
      scores = papers.map((p) => academicRuleScore(query, p));
    }
  } else {
    scores = papers.map((p) => academicRuleScore(query, p));
  }
  return papers
    .map((paper, i) => ({ paper, relevance: scores[i] ?? 0 }))
    .filter((r) => r.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance);
}

// ==================== 网页(产业) ====================

export interface RerankedWeb {
  item: WebResult;
  relevance: number;
}

function webRuleScore(query: string, w: WebResult): number {
  return Math.round(keywordHitScore(query, `${w.title ?? ""} ${w.snippet ?? w.description ?? ""}`));
}

export async function rerankWeb(
  query: string,
  items: WebResult[],
  opts: RerankOptions = {},
): Promise<RerankedWeb[]> {
  if (items.length === 0) return [];
  const useLLM = hasAIKey();
  const minRelevance = opts.minRelevance ?? (useLLM ? 40 : 0);
  let scores: number[];
  if (useLLM) {
    try {
      scores = await llmScores(query, items.map((w) => ({ title: w.title, snippet: w.snippet ?? w.description })));
    } catch {
      scores = items.map((w) => webRuleScore(query, w));
    }
  } else {
    scores = items.map((w) => webRuleScore(query, w));
  }
  return items
    .map((item, i) => ({ item, relevance: scores[i] ?? 0 }))
    .filter((r) => r.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance);
}

// ==================== 开源(GitHub) ====================

export interface RerankedRepo {
  repo: GithubRepo;
  relevance: number;
}

export async function rerankGithub(
  query: string,
  repos: GithubRepo[],
  opts: RerankOptions = {},
): Promise<RerankedRepo[]> {
  if (repos.length === 0) return [];
  const useLLM = hasAIKey();
  const minRelevance = opts.minRelevance ?? (useLLM ? 40 : 0);
  const ruleScore = (r: GithubRepo) =>
    Math.round(keywordHitScore(query, `${r.fullName ?? ""} ${r.description ?? ""}`));
  let scores: number[];
  if (useLLM) {
    try {
      scores = await llmScores(query, repos.map((r) => ({ title: r.fullName ?? r.name, snippet: r.description })));
    } catch {
      scores = repos.map(ruleScore);
    }
  } else {
    scores = repos.map(ruleScore);
  }
  return repos
    .map((repo, i) => ({ repo, relevance: scores[i] ?? 0 }))
    .filter((r) => r.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance);
}
