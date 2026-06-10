// 最终报告契约:聚合各 Agent 输出 + 辩论 + 仲裁 + 质检 + 记忆洞察
// 参考旧库 src/agents/types.ts(FinalReport 体系)与 src/types.ts(AnalysisReport)重写。

import type { ConfidenceLevel } from "./common";
import type {
  AgentOutput,
  CrossDomainScoutOutput,
  InnovationRadarDimension,
  SimilarPaper,
} from "./agent";
import type { DualTrackResult } from "./search";

// ==================== 仲裁(加权透明化) ====================

/** 加权评分明细项(原始分 → 权重 → 加权分,全程透明) */
export interface WeightedScoreItem {
  raw: number;
  weight: number;
  weighted: number;
  confidence: ConfidenceLevel;
}

/** 仲裁结果 */
export interface ArbitrationResult {
  summary: string;
  overallScore: number;
  recommendation: string;
  conflictsResolved: string[];
  nextSteps: string[];
  isPartial?: boolean;
  reasoningContent?: string; // R1 思维链
  usedModel?: string;
  weightedBreakdown: {
    academic: WeightedScoreItem;
    industry: WeightedScoreItem;
    innovation: WeightedScoreItem;
    competitor: WeightedScoreItem;
  };
  consensusLevel: "strong" | "moderate" | "weak"; // 专家共识度
  dissent: string[]; // 少数派异议
  crossDomainVerification?: {
    overallAssessment: string;
    verifiedBridges: string[];
    questionableClaims: string[];
    enhancedSuggestions: string[];
  };
}

// ==================== 质检 ====================

/** 质量把关结果(逻辑一致性检查 + 自动修正) */
export interface QualityCheckResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
  consistencyScore: number; // 0-100
  corrections: Array<{ field: string; from: string; to: string; reason: string }>;
}

// ==================== NovoDebate 对抗辩论 ====================

/** 单轮辩论交锋记录 */
export interface DebateExchange {
  round: number;
  challenger: string;
  challengerArgument: string;
  challengerEvidence: string[];
  defender: string;
  defenderRebuttal: string;
  defenderEvidence: string[];
  outcome: "challenger_wins" | "defender_wins" | "draw";
  isOverwhelming?: boolean; // 压倒性胜利(早停)
  outcomeReasoning: string;
}

/** 单场辩论结果 */
export interface DebateSession {
  sessionId: string;
  topic: string;
  proAgent: string;
  conAgent: string;
  scoreDivergence: number; // 触发辩论的评分差(>15)
  exchanges: DebateExchange[];
  verdict: string;
  keyInsights: string[];
  scoreAdjustment: { proAgentDelta: number; conAgentDelta: number };
}

/** 结构化分歧项 */
export interface DissentItem {
  dimension: string;
  proAgent: string;
  proPosition: string;
  conAgent: string;
  conPosition: string;
  severity: "high" | "medium" | "low";
  resolution: string;
  roundsDebated: number;
  winner: "pro" | "con" | "draw";
}

/** 完整辩论记录 */
export interface DebateRecord {
  triggered: boolean; // 是否触发辩论
  triggerReason: string; // 触发/跳过原因(透明化)
  sessions: DebateSession[];
  totalDurationMs: number;
  dissentReport: DissentItem[]; // 结构化分歧报告(核心产出)
  dissentReportText: string; // 文本版(供仲裁员 prompt)
}

// ==================== 记忆洞察 ====================

/** 本次分析使用的历史经验参考(记忆层 RAG 注入) */
export interface MemoryInsight {
  experiencesUsed: number;
  relevantQueries: string[];
  contextSummary: string;
}

// ==================== 聚合报告 ====================

/** 引擎产出的完整报告(各 Agent 输出 + 辩论 + 仲裁 + 质检) */
export interface FinalReport {
  academicReview: AgentOutput;
  industryAnalysis: AgentOutput;
  innovationEvaluation: AgentOutput;
  competitorAnalysis: AgentOutput;
  crossDomainTransfer?: CrossDomainScoutOutput;
  debate: DebateRecord;
  arbitration: ArbitrationResult;
  qualityCheck: QualityCheckResult;
  memoryInsight?: MemoryInsight;
  /** 插件 Agent 输出列表(管线热插拔注入的分析结果,铁律①) */
  pluginAgentOutputs?: AgentOutput[];
}

/**
 * 面向报告渲染的分析报告视图。
 * 由 FinalReport + DualTrackResult 投影而来,含缓存/降级透明化字段。
 */
export interface AnalysisReport {
  rawText: string;
  academicText: string;
  internetText: string;
  noveltyScore?: number; // 学术创新分
  internetNoveltyScore?: number; // 产业创新分
  practicalScore?: number;
  commercialScore?: number;
  summary?: string;
  keyDifferentiators?: string;
  improvementSuggestions?: string;
  similarPapers?: SimilarPaper[];
  innovationRadar?: InnovationRadarDimension[];
  dualTrackResult?: DualTrackResult;
  usedModel?: string;
  // 透明化字段(对应端到端验收:缓存命中标注、部分结果不白屏)
  isPartial?: boolean;
  fromCache?: boolean;
  cacheSavedMs?: number;
}
