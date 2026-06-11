// Novoscan 默认管线(通用型)——平台开箱即用的通用创新分析管线。
// 将旧库硬编码的 L1→L4 流程翻译成"配方"。将来 Studio/市场的自制管线在它之外新增。
// 也是 Agentic Mode(施工第3步)的地基:Agentic = 智能体自主生成这样的配方。
// 阶段 5 起 step 经 toolRef 引用真子 Agent(EngineTool),入参由 mapInput 从前序结果构造;
// 模型按三档分派:L1/L2 分析=standard,辩论裁判/仲裁=strong(resolveTier 集中管理,可环境变量覆盖)。

import type {
  AgentInput,
  AgentOutput,
  ArbitrationResult,
  CrossDomainScoutOutput,
  DebateRecord,
  FinalReport,
  QualityCheckResult,
} from "@/lib/types";
import { resolveTier, TIMEOUTS } from "@/core/ai-client";
import { definePipeline } from "../define";
import { registerPipeline } from "../registry";
import type { ScoringWeights } from "../types";

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

const SCORING: ScoringWeights = { academic: 0.3, industry: 0.3, innovation: 0.25, competitor: 0.15 };

// mapInput 辅助:从原始输入取公共字段。
const baseFields = (input: AgentInput) => ({
  query: input.query,
  language: input.language,
  domainHint: input.domainHint,
  memoryContext: input.memoryContext,
});

// L2/L3 入参:上游结果缺失时给降级占位(isFallback),保证下游照常推进。
const upstream = (results: Record<string, unknown>) => ({
  academic: get<AgentOutput>(results, "academic") ?? missingOutput("学术审查员"),
  industry: get<AgentOutput>(results, "industry") ?? missingOutput("产业分析员"),
  competitor: get<AgentOutput>(results, "competitor") ?? missingOutput("竞品侦探"),
});

export const novoscanDefaultPipeline = definePipeline({
  id: "novoscan-default",
  version: "2.0.0", // 阶段 5:stub → 真子 Agent(EngineTool)
  type: "通用型",
  name: { zh: "Novoscan 默认管线", en: "Novoscan Default Pipeline" },
  description: {
    zh: "平台通用型创新分析管线:双轨检索 + 多 Agent 分层分析(学术/产业/竞品/跨域)+ 创新评估 + 条件辩论 + 加权仲裁 + 质检。",
    en: "General-purpose innovation analysis pipeline: dual-track retrieval + layered multi-agent analysis + innovation scoring + conditional debate + weighted arbitration + quality check.",
  },
  scoring: SCORING,
  plugins: [],
  layers: [
    {
      id: "L1",
      mode: "parallel",
      majority: 2, // 3 个关键路径 Agent 中 2 个真实完成即进 L2
      steps: [
        {
          id: "academic",
          toolRef: "agent.academic",
          model: resolveTier("standard"),
          critical: true,
          // 相似论文逐篇对比让思考模型推理极长(实测可超 110s),单独放宽;
          // majority=2 保证它慢时不阻塞推进,迟到结果仍会进入最终报告。
          timeoutMs: 200_000,
          mapInput: (_results, input) => ({ ...baseFields(input), academicData: input.academicData }),
        },
        {
          id: "industry",
          toolRef: "agent.industry",
          model: resolveTier("standard"),
          critical: true,
          mapInput: (_results, input) => ({ ...baseFields(input), industryData: input.industryData }),
        },
        {
          id: "competitor",
          toolRef: "agent.competitor",
          model: resolveTier("standard"),
          critical: true,
          mapInput: (_results, input) => ({ ...baseFields(input), industryData: input.industryData }),
        },
        // 跨域侦察兵:后台非关键,不阻塞推进
        {
          id: "crossDomain",
          toolRef: "agent.crossDomain",
          model: resolveTier("standard"),
          critical: false,
          timeoutMs: 200_000, // 后台非阻塞;桥梁+知识图谱输出大,思考模型耗时长
          mapInput: (_results, input) => ({
            query: input.query,
            language: input.language,
            domainHint: input.domainHint,
            academicData: input.academicData,
            industryData: input.industryData,
          }),
        },
      ],
    },
    {
      id: "L2",
      mode: "serial",
      steps: [
        {
          id: "innovation",
          toolRef: "agent.innovation",
          model: resolveTier("standard"),
          mapInput: (results, input) => ({ ...baseFields(input), ...upstream(results) }),
        },
      ],
    },
    {
      id: "L2.5",
      mode: "serial",
      steps: [
        {
          id: "debate",
          toolRef: "agent.debate",
          model: resolveTier("strong"), // 辩论裁判推理质量关键(攻防发言由工具内部走 fast 档)
          condition: (results) => scoreDivergence(results) > 15,
          timeoutMs: 120_000, // 多轮多调用,超出单 Agent 默认预算
          mapInput: (results, input) => ({
            query: input.query,
            language: input.language,
            ...upstream(results),
            innovation: get<AgentOutput>(results, "innovation") ?? missingOutput("创新评估师"),
          }),
        },
      ],
    },
    {
      id: "L3",
      mode: "serial",
      steps: [
        {
          id: "arbitration",
          toolRef: "agent.arbitration",
          model: resolveTier("strong"), // 仲裁=结论可信度核心
          timeoutMs: TIMEOUTS.arbitratorMs,
          mapInput: (results, input) => ({
            query: input.query,
            language: input.language,
            domainHint: input.domainHint,
            ...upstream(results),
            innovation: get<AgentOutput>(results, "innovation") ?? missingOutput("创新评估师"),
            debate: get<DebateRecord>(results, "debate"),
            crossDomain: get<CrossDomainScoutOutput>(results, "crossDomain"),
            weights: SCORING,
          }),
        },
      ],
    },
    {
      id: "L4",
      mode: "serial",
      steps: [
        {
          id: "quality",
          toolRef: "agent.quality", // 纯逻辑,无模型
          mapInput: (results) => ({
            arbitration: get<ArbitrationResult>(results, "arbitration") ?? defaultArbitration(),
            agents: [
              ...Object.values(upstream(results)),
              get<AgentOutput>(results, "innovation") ?? missingOutput("创新评估师"),
            ],
            debate: get<DebateRecord>(results, "debate"),
          }),
        },
      ],
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
