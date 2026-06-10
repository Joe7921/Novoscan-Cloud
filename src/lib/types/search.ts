// 双轨检索(学术 + 产业)结果契约
// 参考旧库 src/types.ts 的 DualTrackResult 体系重写。
// 阶段 4 的 core/search 产出这些结构,阶段 5 的 Agent 消费它们。

import type { ConfidenceLevel, SupportStrength } from "./common";

// ==================== 学术轨 ====================

/** 学术论文条目(聚合四源:OpenAlex / arXiv / CrossRef / CORE) */
export interface AcademicPaper {
  title?: string;
  year?: number;
  citationCount?: number;
  authors?: string[];
  url?: string;
  pdfUrl?: string;
  isOpenAccess?: boolean;
  concepts?: string[];
  venue?: string; // 发表期刊/会议
  description?: string;
  /** 允许各数据源携带额外字段 */
  [key: string]: unknown;
}

/** 学术检索统计 */
export interface AcademicStats {
  totalPapers: number;
  totalCitations: number;
  openAccessCount: number;
  avgCitation: number;
  bySource: { openAlex: number; arxiv: number; crossref: number; core: number };
  topCategories: string[];
}

/** 学术轨聚合结果 */
export interface AcademicResult {
  results: AcademicPaper[];
  stats: AcademicStats;
  topConcepts: string[];
  openAccessCount: number;
}

// ==================== 产业轨 ====================

/** 网页搜索结果条目 */
export interface WebResult {
  title?: string;
  url?: string;
  snippet?: string;
  description?: string;
  source?: string;
  [key: string]: unknown;
}

/** GitHub 仓库条目 */
export interface GithubRepo {
  name?: string;
  fullName?: string;
  stars?: number;
  health?: string;
  language?: string;
  topics?: string[];
  description?: string;
  [key: string]: unknown;
}

/** 产业轨聚合结果(Brave / SerpAPI / GitHub / 微信公众号 等) */
export interface IndustryResult {
  webResults: WebResult[];
  webSources: { brave: number; serpapi: number; tavily?: number };
  githubRepos: GithubRepo[];
  sentiment: "hot" | "warm" | "cold";
  hasOpenSource: boolean;
  topProjects: Array<{ name: string; stars: number; health: string }>;
}

// ==================== 交叉验证与可信度 ====================

/** 学术 × 产业交叉验证 */
export interface CrossValidation {
  consistencyScore: number;
  academicSupport: SupportStrength;
  industrySupport: SupportStrength;
  openSourceVerified: boolean;
  conceptOverlap: string[];
  redFlags: string[];
  insights: string[];
}

/** 可信度评估(可信度优先=本产品核心价值) */
export interface Credibility {
  score: number;
  level: ConfidenceLevel;
  reasoning: string[];
}

// ==================== 双轨总结果 ====================

/** 双轨检索完整结果 */
export interface DualTrackResult {
  academic: AcademicResult;
  industry: IndustryResult;
  crossValidation: CrossValidation;
  finalCredibility: Credibility;
  recommendation: string;
  searchTimeMs: number;
}
