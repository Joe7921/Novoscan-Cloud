// 学术轨聚合:多关键词变体 × 四源并行检索 → 标题去重 → 证据闸门(相关性重排+过滤)
// → 统计,产出统一 AcademicResult。参考旧库 search/academic.ts + dual-track 统计逻辑重写。

import type { AcademicPaper, AcademicResult, AcademicStats, OnProgress } from "@/lib/types";
import { searchArxiv } from "./academic/arxiv";
import { searchCore } from "./academic/core";
import { searchCrossRef } from "./academic/crossref";
import { searchOpenAlex } from "./academic/openalex";
import { buildQueryVariants } from "./keyword";
import { rerankAcademic } from "./rerank";

function dedupeByTitle(papers: AcademicPaper[]): AcademicPaper[] {
  const seen = new Set<string>();
  const out: AcademicPaper[] = [];
  for (const p of papers) {
    const key = (p.title ?? "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function computeStats(papers: AcademicPaper[]): { stats: AcademicStats; topConcepts: string[] } {
  const bySource = { openAlex: 0, arxiv: 0, crossref: 0, core: 0 };
  let totalCitations = 0;
  let openAccessCount = 0;
  const conceptFreq = new Map<string, number>();

  for (const p of papers) {
    switch (String(p.source ?? "")) {
      case "openalex": bySource.openAlex++; break;
      case "arxiv": bySource.arxiv++; break;
      case "crossref": bySource.crossref++; break;
      case "core": bySource.core++; break;
    }
    totalCitations += p.citationCount ?? 0;
    if (p.isOpenAccess || p.pdfUrl) openAccessCount++;
    for (const c of p.concepts ?? []) conceptFreq.set(c, (conceptFreq.get(c) ?? 0) + 1);
  }

  const topConcepts = [...conceptFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map((e) => e[0]);

  const stats: AcademicStats = {
    totalPapers: papers.length,
    totalCitations,
    openAccessCount,
    avgCitation: papers.length ? Math.round(totalCitations / papers.length) : 0,
    bySource,
    topCategories: topConcepts,
  };
  return { stats, topConcepts };
}

export interface SearchAcademicOptions {
  fromYear?: number;
  perSourceLimit?: number; // 每源每变体取多少
  topK?: number; // 证据闸门后保留前 K
  minRelevance?: number;
  onProgress?: OnProgress;
}

export async function searchAcademic(
  query: string,
  opts: SearchAcademicOptions = {},
): Promise<AcademicResult> {
  const fromYear = opts.fromYear ?? 2020;
  const perSource = opts.perSourceLimit ?? 10;
  const topK = opts.topK ?? 20;
  const emit = opts.onProgress;

  // 1. 关键词 + 中英双语变体
  const variants = await buildQueryVariants(query);
  emit?.("log", `学术检索:${variants.length} 组关键词`);

  // 2. 各变体 × 四源 并行(失败的源返回空,不阻塞)
  const tasks: Array<Promise<AcademicPaper[]>> = [];
  for (const v of variants) {
    tasks.push(
      searchOpenAlex(v, { fromYear, perPage: perSource }),
      searchArxiv(v, { maxResults: perSource }),
      searchCrossRef(v, { fromYear, rows: perSource }),
      searchCore(v, { fromYear, limit: perSource }),
    );
  }
  const settled = await Promise.allSettled(tasks);
  const raw = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const deduped = dedupeByTitle(raw);
  emit?.("log", `召回 ${raw.length} 条,去重后 ${deduped.length} 条`);

  // 3. 证据闸门:相关性重排 + 过滤(治"垃圾进")
  const reranked = await rerankAcademic(query, deduped, { minRelevance: opts.minRelevance });
  const kept = reranked.slice(0, topK).map((r) => r.paper);
  emit?.("log", `证据闸门:${deduped.length} → ${kept.length} 条高相关`);
  if (kept.length < 3) {
    emit?.("log", `⚠️ 高相关学术证据不足(${kept.length} 条),该方向学术支撑可能较弱`);
  }

  // 4. 统计
  const { stats, topConcepts } = computeStats(kept);
  return { results: kept, stats, topConcepts, openAccessCount: stats.openAccessCount };
}
