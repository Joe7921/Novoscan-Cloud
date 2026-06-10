// 双轨聚合:学术轨 + 产业轨并行 → 交叉验证(支撑度/风险/洞察)+ 可信度评分。
// 这是"可信度优先"的闭环:学术强/产业弱之类的矛盾会被标记,可信度透明可解释。
// 参考旧库 search/dual-track.ts 的交叉验证与可信度逻辑重写。

import type {
  Credibility,
  CrossValidation,
  DualTrackResult,
  OnProgress,
  SupportStrength,
} from "@/lib/types";
import { searchAcademic } from "./academic-aggregate";
import { searchIndustry } from "./industry-aggregate";

function strength(n: number, hi: number, mid: number): SupportStrength {
  return n >= hi ? "strong" : n >= mid ? "moderate" : "weak";
}

export interface SearchDualOptions {
  onProgress?: OnProgress;
}

export async function searchDualTrack(
  query: string,
  opts: SearchDualOptions = {},
): Promise<DualTrackResult> {
  const start = Date.now();
  const emit = opts.onProgress;

  const [academic, industry] = await Promise.all([
    searchAcademic(query, { onProgress: emit }),
    searchIndustry(query, { onProgress: emit }),
  ]);

  const paperCount = academic.results.length;
  const webCount = industry.webResults.length;
  const ghCount = industry.githubRepos.length;

  const academicSupport = strength(paperCount, 21, 6);
  const industrySupport = strength(webCount + ghCount * 3, 15, 5);

  // 交叉验证:风险 + 洞察
  const redFlags: string[] = [];
  const insights: string[] = [];
  if (academicSupport === "strong" && industrySupport === "weak")
    redFlags.push("学术热度高但产业落地/讨论极少,可能存在技术转化风险");
  if (industrySupport === "strong" && academicSupport === "weak")
    redFlags.push("产业/媒体热度高但学术支撑不足,需警惕概念炒作");
  if (paperCount === 0 && webCount === 0)
    redFlags.push("学术与产业证据都很稀缺,该方向信息严重不足");
  if (paperCount > 0) insights.push(`${paperCount} 篇高相关论文`);
  if (industry.hasOpenSource) insights.push(`${ghCount} 个相关开源项目`);
  if (webCount > 0) insights.push(`${webCount} 条产业资讯/产品`);

  let consistencyScore = 40;
  if (paperCount > 0) consistencyScore += 15;
  if (webCount > 0) consistencyScore += 10;
  if (industry.hasOpenSource) consistencyScore += 15;
  consistencyScore = Math.max(0, Math.min(100, consistencyScore - redFlags.length * 10));

  const crossValidation: CrossValidation = {
    consistencyScore,
    academicSupport,
    industrySupport,
    openSourceVerified: industry.hasOpenSource,
    conceptOverlap: academic.topConcepts.slice(0, 5),
    redFlags,
    insights,
  };

  // 可信度评分(基础分 + 多源加分 - 风险扣分)
  let score = 10;
  if (paperCount > 0 && (industry.hasOpenSource || webCount > 0)) score = 60;
  else if (paperCount > 0) score = 40;
  else if (industry.hasOpenSource && webCount > 0) score = 45;
  else if (webCount >= 3) score = 25;
  const totalCitations = academic.stats.totalCitations;
  if (totalCitations > 1000) score += 15;
  else if (totalCitations > 100) score += 10;
  else if (totalCitations > 10) score += 5;
  if (industry.hasOpenSource) score += 10;
  if (webCount >= 5) score += 5;
  score = Math.max(0, Math.min(100, score - redFlags.length * 10));
  const level = score >= 75 ? "high" : score >= 50 ? "medium" : "low";

  const finalCredibility: Credibility = {
    score,
    level,
    reasoning: [
      `学术支撑:${academicSupport}(${paperCount} 篇)`,
      `产业支撑:${industrySupport}(网页 ${webCount}、开源 ${ghCount})`,
      ...redFlags,
    ],
  };

  let recommendation: string;
  if (level === "high" && industry.hasOpenSource)
    recommendation = "学术基础扎实且有开源验证,产业落地有据。建议深入调研差异化空间。";
  else if (level === "high") recommendation = "学术基础扎实,理论可行性高。建议关注工程化落地机会。";
  else if (level === "low")
    recommendation = redFlags.length
      ? `存在风险:${redFlags[0]}。建议谨慎评估。`
      : "信息不足,建议扩大调研范围或更换关键词。";
  else
    recommendation = industry.hasOpenSource
      ? "有一定基础且有开源实现,建议聚焦差异化创新点。"
      : "有一定学术基础但产业验证不足,建议进一步调研工程可行性。";

  emit?.("log", `双轨完成:可信度 ${score}(${level})、共识 ${consistencyScore}`);
  return {
    academic,
    industry,
    crossValidation,
    finalCredibility,
    recommendation,
    searchTimeMs: Date.now() - start,
  };
}
