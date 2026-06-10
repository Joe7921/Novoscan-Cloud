// 占位 stub Agent(阶段 3 骨架)。返回结构完整的假输出,让"空管线"端到端跑通。
// 真 Agent(调模型 + Prompt)在阶段 5 实现并替换这里的注册。

import type {
  AgentOutput,
  ArbitrationResult,
  CrossDomainScoutOutput,
  DebateRecord,
  InnovationRadarDimension,
  QualityCheckResult,
  WeightedScoreItem,
} from "@/lib/types";
import { registerAgent } from "./registry";
import type { AgentDefinition } from "./types";

function stubOutput(agentName: string, score = 70): AgentOutput {
  return {
    agentName,
    analysis: `[stub] ${agentName} 占位分析文本`,
    score,
    confidence: "low",
    confidenceReasoning: "占位数据(阶段 3 骨架,非真实分析)",
    keyFindings: [`[stub] ${agentName} 关键发现`],
    redFlags: [],
    evidenceSources: [],
    reasoning: "[stub] 占位推理",
    dimensionScores: [],
    isStub: true,
  };
}

const RADAR: InnovationRadarDimension[] = [
  { key: "techBreakthrough", nameZh: "技术突破", nameEn: "Tech Breakthrough", score: 70, reasoning: "[stub]" },
  { key: "appSuitability", nameZh: "应用适配", nameEn: "Application Suitability", score: 70, reasoning: "[stub]" },
  { key: "competitive", nameZh: "竞争壁垒", nameEn: "Competitive Edge", score: 70, reasoning: "[stub]" },
  { key: "implementable", nameZh: "可实现性", nameEn: "Implementability", score: 70, reasoning: "[stub]" },
  { key: "profitable", nameZh: "商业潜力", nameEn: "Profitability", score: 70, reasoning: "[stub]" },
  { key: "sustainable", nameZh: "可持续性", nameEn: "Sustainability", score: 70, reasoning: "[stub]" },
];

function weighted(raw: number, weight: number): WeightedScoreItem {
  return { raw, weight, weighted: Math.round(raw * weight), confidence: "low" };
}

// L1:学术 / 产业 / 竞品(国产模型)
const academicReviewer: AgentDefinition = {
  id: "academic",
  description: "学术审查员(占位)",
  run: async () => ({
    ...stubOutput("学术审查员"),
    similarPapers: [
      { title: "[stub] 相似论文", year: 2024, similarityScore: 60, keyDifference: "[stub] 差异", authorityLevel: "medium" },
    ],
  }),
};

const industryAnalyst: AgentDefinition = {
  id: "industry",
  description: "产业分析员(占位)",
  run: async () => stubOutput("产业分析员"),
};

const competitorDetective: AgentDefinition = {
  id: "competitor",
  description: "竞品侦探(占位)",
  run: async () => stubOutput("竞品侦探"),
};

// L1 非关键路径:跨域侦察兵
const crossDomainScout: AgentDefinition = {
  id: "crossDomain",
  description: "跨域侦察兵(占位)",
  run: async (): Promise<CrossDomainScoutOutput> => ({
    ...stubOutput("跨域侦察兵"),
    bridges: [],
    knowledgeGraph: { nodes: [], edges: [] },
    exploredDomains: [],
    transferSummary: "[stub] 跨域迁移总结",
  }),
};

// L2:创新评估师(输出六维雷达)
const innovationEvaluator: AgentDefinition = {
  id: "innovation",
  description: "创新评估师(占位)",
  run: async () => ({ ...stubOutput("创新评估师"), innovationRadar: RADAR }),
};

// L2.5:辩论裁判(Sonnet 4.6)——占位返回"未触发"
const debateJudge: AgentDefinition = {
  id: "debate",
  description: "辩论裁判(占位)",
  run: async (): Promise<DebateRecord> => ({
    triggered: false,
    triggerReason: "[stub] 占位:未触发辩论",
    sessions: [],
    totalDurationMs: 0,
    dissentReport: [],
    dissentReportText: "",
  }),
};

// L3:仲裁员(Sonnet 4.6)
const arbitrator: AgentDefinition = {
  id: "arbitration",
  description: "仲裁员(占位)",
  run: async (): Promise<ArbitrationResult> => ({
    summary: "[stub] 占位仲裁结论",
    overallScore: 70,
    recommendation: "[stub] 建议",
    conflictsResolved: [],
    nextSteps: [],
    weightedBreakdown: {
      academic: weighted(70, 0.3),
      industry: weighted(70, 0.3),
      innovation: weighted(70, 0.25),
      competitor: weighted(70, 0.15),
    },
    consensusLevel: "moderate",
    dissent: [],
  }),
};

// L4:质检(纯逻辑,无 AI)
const qualityGuard: AgentDefinition = {
  id: "quality",
  description: "质量把关(占位,纯逻辑)",
  run: async (): Promise<QualityCheckResult> => ({
    passed: true,
    issues: [],
    warnings: [],
    consistencyScore: 80,
    corrections: [],
  }),
};

/** 注册全部占位 Agent(模块加载即执行)。 */
export function registerStubAgents(): void {
  for (const agent of [
    academicReviewer,
    industryAnalyst,
    competitorDetective,
    crossDomainScout,
    innovationEvaluator,
    debateJudge,
    arbitrator,
    qualityGuard,
  ]) {
    registerAgent(agent);
  }
}

registerStubAgents();
