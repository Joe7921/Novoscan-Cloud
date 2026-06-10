// 产业轨聚合:引擎选择 → 一级源并行(Brave+SerpAPI+GitHub) → 降级链(Serper→Tavily→SearXNG)
// → 网页证据闸门(相关性重排过滤) → 情绪/开源判断,产出统一 IndustryResult。
// 参考旧库 search/industry.ts 重写。

import type { GithubRepo, IndustryResult, OnProgress, WebResult } from "@/lib/types";
import { selectEngines } from "./engine-selector";
import { searchBrave } from "./industry/brave";
import { searchGithub } from "./industry/github";
import { searchSearXNG } from "./industry/searxng";
import { searchSerpAPI } from "./industry/serpapi";
import { searchSerper } from "./industry/serper";
import { searchTavily } from "./industry/tavily";
import { buildQueryVariants } from "./keyword";
import { rerankGithub, rerankWeb } from "./rerank";

function dedupeByUrl(items: WebResult[]): WebResult[] {
  const seen = new Set<string>();
  const out: WebResult[] = [];
  for (const it of items) {
    const key = (it.url ?? "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function dedupeRepos(repos: GithubRepo[]): GithubRepo[] {
  const seen = new Set<string>();
  const out: GithubRepo[] = [];
  for (const r of repos) {
    const key = (r.fullName ?? r.name ?? "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export interface SearchIndustryOptions {
  topK?: number;
  onProgress?: OnProgress;
}

export async function searchIndustry(
  query: string,
  opts: SearchIndustryOptions = {},
): Promise<IndustryResult> {
  const topK = opts.topK ?? 15;
  const emit = opts.onProgress;

  const [selection, variants] = await Promise.all([selectEngines(query), buildQueryVariants(query)]);
  // GitHub 用英文关键词搜(中文直搜 GitHub 命中差且易召回无关高星 repo)
  const enQuery = variants.find((v) => /[a-zA-Z]/.test(v) && !/[一-龥]/.test(v)) ?? query;
  emit?.("log", `引擎选择(${selection.method}): ${selection.serpEngines.join("+")}`);

  // 一级:Brave + SerpAPI(各选定引擎) + GitHub 并行
  const serpTasks = selection.serpEngines.map((engine) => searchSerpAPI(query, { engine, num: 10 }));
  const [brave, serps, github] = await Promise.all([
    searchBrave(query, { count: 10 }).catch(() => [] as WebResult[]),
    Promise.all(serpTasks).then((rs) => rs.flat()).catch(() => [] as WebResult[]),
    searchGithub(enQuery, { perPage: 10 }).catch(() => [] as GithubRepo[]),
  ]);

  let web = dedupeByUrl([...brave, ...serps]);

  // 降级链:一级网页为空时依次尝试 Serper → Tavily → SearXNG
  if (web.length === 0) {
    emit?.("log", "一级网页源无结果,启用降级链(Serper→Tavily→SearXNG)");
    web = await searchSerper(query).catch(() => []);
    if (web.length === 0) web = await searchTavily(query).catch(() => []);
    if (web.length === 0) web = await searchSearXNG(query).catch(() => []);
    web = dedupeByUrl(web);
  }

  // 网页证据闸门:相关性重排 + 过滤(治"垃圾进")
  const rerankedWeb = await rerankWeb(query, web);
  const keptWeb = rerankedWeb.slice(0, topK).map((r) => r.item);
  emit?.("log", `网页证据闸门: ${web.length} → ${keptWeb.length} 条高相关`);

  // 开源证据闸门:repos 也过相关性过滤(治中文搜召回的无关高星 repo)
  const rerankedRepos = await rerankGithub(query, dedupeRepos(github));
  const repos = rerankedRepos.map((r) => r.repo);
  emit?.("log", `开源证据闸门: ${github.length} → ${repos.length} 个高相关`);
  const totalSignals = keptWeb.length;
  const sentiment: IndustryResult["sentiment"] =
    totalSignals > 20 ? "hot" : totalSignals > 5 ? "warm" : "cold";
  const topProjects = repos
    .slice(0, 3)
    .map((r) => ({ name: r.name ?? r.fullName ?? "", stars: r.stars ?? 0, health: r.health ?? "stable" }));

  return {
    webResults: keptWeb,
    webSources: { brave: brave.length, serpapi: serps.length },
    githubRepos: repos,
    sentiment,
    hasOpenSource: repos.length > 0,
    topProjects,
  };
}
