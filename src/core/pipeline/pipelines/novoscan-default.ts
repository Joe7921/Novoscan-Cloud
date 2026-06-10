// Novoscan 默认管线(通用型)——平台开箱即用的通用创新分析管线。
// 将旧库硬编码的 L1→L4 流程翻译成"配方"。将来 Studio/市场的自制管线在它之外新增。
// 也是 Agentic Mode(施工第3步)的地基:Agentic = 智能体自主生成这样的配方。

import type {
  AgentOutput,
  ArbitrationResult,
  CrossDomainScoutOutput,
  DebateRecord,
  FinalReport,
  QualityCheckResult,
} from "@/lib/types";
import { definePipeline } from "../define";
import { registerPipeline } from "../registry";

const get = <T>(results: Record<string, unknown>, key: string): T | undefined =>
  results[key] as T | undefined;

// 计算 L1/L2 各 Agent 评分的最大分歧(用于辩论触发条件)。
function scoreDivergence(results: Record<string, unknown>): number {
  const scores = ["academic", "industry", "innovation", "competitor"]
    .map((k) => get<AgentOutput>(results, k)?.score)
    .filter((s): s is number => typeof s === "number");
  if (scores.length < 2) return 0;
  return Math.max(...scores) - Math.min(...scores);
}

function missingOutput(agentName: string): AgentOutput {
  return {
    agentName,
    analysis: "",
    score: 0,
    confidence: "low",
    confidenceReasoning: "该 Agent 结果缺失(超时或未执行)",
    keyFindings: [],
    redFlags: [],
    evidenceSources: [],
    reasoning: "",
    dimensionScores: [],
    isFallback: true,
  };
}

const DEFAULT_DEBATE: DebateRecord = {
  triggered: false,
  triggerReason: "评分分歧不足或未执行,未触发辩论",
  sessions: [],
  totalDurationMs: 0,
  dissentReport: [],
  dissentReportText: "",
};

const DEFAULT_QUALITY: QualityCheckResult = {
  passed: true,
  issues: [],
  warnings: ["质检结果缺失,默认放行"],
  consistencyScore: 0,
  corrections: [],
};

function defaultArbitration(): ArbitrationResult {
  const w = { raw: 0, weight: 0, weighted: 0, confidence: "low" as const };
  return {
    summary: "仲裁结果缺失",
    overallScore: 0,
    recommendation: "",
    conflictsResolved: [],
    nextSteps: [],
    isPartial: true,
    weightedBreakdown: { academic: w, industry: w, innovation: w, competitor: w },
    consensusLevel: "weak",
    dissent: [],
  };
}

export const novoscanDefaultPipeline = definePipeline({
  id: "novoscan-default",
  version: "1.0.0",
  type: "通用型",
  name: { zh: "Novoscan 默认管线", en: "Novoscan Default Pipeline" },
  description: {
    zh: "平台通用型创新分析管线:双轨检索 + 多 Agent 分层分析(学术/产业/竞品/跨域)+ 创新评估 + 条件辩论 + 加权仲裁 + 质检。",
    en: "General-purpose innovation analysis pipeline: dual-track retrieval + layered multi-agent analysis + innovation scoring + conditional debate + weighted arbitration + quality check.",
  },
  scoring: { academic: 0.3, industry: 0.3, innovation: 0.25, competitor: 0.15 },
  plugins: [],
  layers: [
    {
      id: "L1",
      mode: "parallel",
      majority: 2, // 3 个关键路径 Agent 中 2 个真实完成即进 L2
      steps: [
        { id: "academic", agentRef: "academic", model: { provider: "deepseek" }, critical: true },
        { id: "industry", agentRef: "industry", model: { provider: "minimax" }, critical: true },
        { id: "competitor", agentRef: "competitor", model: { provider: "moonshot" }, critical: true },
        // 跨域侦察兵:后台非关键,不阻塞推进
        { id: "crossDomain", agentRef: "crossDomain", model: { provider: "deepseek" }, critical: false },
      ],
    },
    {
      id: "L2",
      mode: "serial",
      steps: [{ id: "innovation", agentRef: "innovation", model: { provider: "deepseek" } }],
    },
    {
      id: "L2.5",
      mode: "serial",
      steps: [
        {
          id: "debate",
          agentRef: "debate",
          model: { provider: "anthropic" }, // 辩论裁判用 Sonnet 4.6
          condition: (results) => scoreDivergence(results) > 15,
        },
      ],
    },
    {
      id: "L3",
      mode: "serial",
      steps: [{ id: "arbitration", agentRef: "arbitration", model: { provider: "anthropic" } }], // 仲裁用 Sonnet 4.6
    },
    {
      id: "L4",
      mode: "serial",
      steps: [{ id: "quality", agentRef: "quality" }], // 纯逻辑,无模型
    },
  ],
  assemble(results): FinalReport {
    return {
      academicReview: get<AgentOutput>(results, "academic") ?? missingOutput("学术审查员"),
      industryAnalysis: get<AgentOutput>(results, "industry") ?? missingOutput("产业分析员"),
      innovationEvaluation: get<AgentOutput>(results, "innovation") ?? missingOutput("创新评估师"),
      competitorAnalysis: get<AgentOutput>(results, "competitor") ?? missingOutput("竞品侦探"),
      crossDomainTransfer: get<CrossDomainScoutOutput>(results, "crossDomain"),
      debate: get<DebateRecord>(results, "debate") ?? DEFAULT_DEBATE,
      arbitration: get<ArbitrationResult>(results, "arbitration") ?? defaultArbitration(),
      qualityCheck: get<QualityCheckResult>(results, "quality") ?? DEFAULT_QUALITY,
    };
  },
});

registerPipeline(novoscanDefaultPipeline);
