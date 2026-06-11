// 仲裁员(L3,strong 模型):整合四位专家意见,动态权重 + 冲突检测 + 透明加权,给出最终裁决。
// 参考旧库 arbitrator.ts 重写为 EngineTool。核心机制:置信度动态调权、冲突矩阵、
// 商业现实纠偏(GitHub 依赖症)、辩论/跨域结果注入、加权明细透明输出。

import { z } from "zod";
import type {
  AgentOutput,
  ArbitrationResult,
  CrossDomainScoutOutput,
  DebateRecord,
  Language,
  WeightedScoreItem,
} from "@/lib/types";
import { parseAgentJSON } from "@/core/ai-client";
import { registerTool, type EngineTool } from "@/core/tools";
import type { ScoringWeights } from "@/core/pipeline";
import {
  RECOMMENDATION_THRESHOLDS,
  asStringArray,
  clampScore,
  languageLine,
  truncate,
} from "./shared";

const agentOutputSchema = z.custom<AgentOutput>((v) => !!v && typeof v === "object");

const inputSchema = z.object({
  query: z.string().describe("用户创意/长文"),
  academic: agentOutputSchema.describe("学术审查员输出"),
  industry: agentOutputSchema.describe("产业分析员输出"),
  innovation: agentOutputSchema.describe("创新评估师输出"),
  competitor: agentOutputSchema.describe("竞品侦探输出"),
  debate: z.custom<DebateRecord>((v) => !v || typeof v === "object").optional().describe("NovoDebate 辩论记录"),
  crossDomain: z
    .custom<CrossDomainScoutOutput>((v) => !v || typeof v === "object")
    .optional()
    .describe("跨域侦察兵输出(需仲裁核验)"),
  weights: z
    .custom<ScoringWeights>((v) => !v || typeof v === "object")
    .optional()
    .describe("管线声明的基础权重(缺省用默认)"),
  language: z.custom<Language>((v) => v === "zh" || v === "en").describe("输出语言"),
  domainHint: z.string().optional().describe("用户指定的学科领域"),
});
type Input = z.infer<typeof inputSchema>;

const DEFAULT_WEIGHTS: ScoringWeights = { academic: 0.3, industry: 0.3, innovation: 0.25, competitor: 0.15 };
const AGENT_KEYS = ["academic", "industry", "innovation", "competitor"] as const;
type AgentKey = (typeof AGENT_KEYS)[number];

const confidenceMultiplier = (c: AgentOutput["confidence"]): number =>
  c === "high" ? 1.0 : c === "medium" ? 0.8 : 0.5;

interface Precomputed {
  scores: Record<AgentKey, number>;
  normalizedWeights: Record<AgentKey, number>;
  avgScore: number;
  stdDev: number;
  conflicts: Array<{ a: string; b: string; diff: number }>;
  weightedReference: number;
}

/** 动态权重 + 冲突矩阵预计算(机械部分代码做,推理部分交模型)。 */
function precompute(input: Input): Precomputed {
  const outputs: Record<AgentKey, AgentOutput> = {
    academic: input.academic,
    industry: input.industry,
    innovation: input.innovation,
    competitor: input.competitor,
  };
  const base = input.weights ?? DEFAULT_WEIGHTS;
  const scores = Object.fromEntries(AGENT_KEYS.map((k) => [k, outputs[k].score ?? 50])) as Record<AgentKey, number>;
  const adjusted = Object.fromEntries(
    AGENT_KEYS.map((k) => [k, base[k] * confidenceMultiplier(outputs[k].confidence)]),
  ) as Record<AgentKey, number>;
  const total = AGENT_KEYS.reduce((s, k) => s + adjusted[k], 0);
  const normalizedWeights = Object.fromEntries(
    AGENT_KEYS.map((k) => [k, Math.round((adjusted[k] / total) * 100) / 100]),
  ) as Record<AgentKey, number>;

  const values = AGENT_KEYS.map((k) => scores[k]);
  const avgScore = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const stdDev = Math.round(Math.sqrt(values.reduce((s, v) => s + (v - avgScore) ** 2, 0) / values.length));

  const names: Record<AgentKey, string> = {
    academic: "学术审查员",
    industry: "产业分析员",
    innovation: "创新评估师",
    competitor: "竞品侦探",
  };
  const conflicts: Array<{ a: string; b: string; diff: number }> = [];
  for (let i = 0; i < AGENT_KEYS.length; i++) {
    for (let j = i + 1; j < AGENT_KEYS.length; j++) {
      const diff = Math.abs(scores[AGENT_KEYS[i]] - scores[AGENT_KEYS[j]]);
      if (diff > 20) conflicts.push({ a: names[AGENT_KEYS[i]], b: names[AGENT_KEYS[j]], diff });
    }
  }
  const weightedReference = Math.round(AGENT_KEYS.reduce((s, k) => s + scores[k] * normalizedWeights[k], 0));
  return { scores, normalizedWeights, avgScore, stdDev, conflicts, weightedReference };
}

function expertBlock(title: string, out: AgentOutput, weight: number): string {
  return `## ${title}(权重:${(weight * 100).toFixed(0)}%)
- 评分:${out.score}/100(置信度:${out.confidence}${out.isFallback ? ",⚠️ 降级数据" : ""})
- 核心发现:${(out.keyFindings ?? []).slice(0, 3).join(" | ") || "无"}
- 风险提示:${(out.redFlags ?? []).slice(0, 3).join(" | ") || "无"}
- 分析摘要:${truncate(out.analysis, 500)}
- 推理要点:${truncate(out.reasoning, 300)}`;
}

function buildPrompt(input: Input, pre: Precomputed): string {
  const { scores, normalizedWeights: w, avgScore, stdDev, conflicts, weightedReference } = pre;
  const debate = input.debate;
  const crossDomain = input.crossDomain;
  const hasCrossDomain = !!crossDomain && !crossDomain.isFallback && (crossDomain.bridges?.length ?? 0) > 0;
  const T = RECOMMENDATION_THRESHOLDS;

  return `
# 系统角色

你是一位资深的技术投资委员会主席,拥有 25 年的风险投资决策经验。
你的核心职责是:**整合四位专家的报告,识别和解决分歧,做出透明的最终决策**。

## 核心原则
1. **透明决策**:每个评分和结论都必须可追溯到具体专家的报告
2. **少数意见保护**:某位专家持明显不同观点时,必须记录其异议
3. **动态权重**:低置信度专家的报告已自动降权(见各权重)
4. **⚠️⚠️ 商业现实纠偏(强制执行)**:
   - **检查规则**:如果产业分析员或竞品侦探的高分/低分评估主要依据是"GitHub 项目数量少/多"或"开源生态空白/活跃",你 **必须** 对该评分做向下/向上修正(幅度 10-25 分)。
   - **修正依据**:开源生态仅占商业技术市场很小部分(通常 < 10%)。真实竞争格局要看:商业痛点刚需程度、企业级产品信号(产品页/定价/案例)、大厂入局可能性。
   - **输出要求**:执行了纠偏必须在 conflictsResolved 中记录具体操作和分值调整。
${input.domainHint ? `5. **学科领域约束**:用户指定领域为「${input.domainHint}」,裁决必须以该领域的创新标准、市场规则和学术范式为基准;偏离该领域语境的专家分析应降权。` : ""}

---

# 被评估的创新点

${input.query}

---

# 四位专家报告

${expertBlock("学术审查员", input.academic, w.academic)}

${expertBlock("产业分析员", input.industry, w.industry)}

${expertBlock("创新评估师", input.innovation, w.innovation)}

${expertBlock("竞品侦探", input.competitor, w.competitor)}
${
  hasCrossDomain
    ? `
## 跨域侦察兵报告(需核验)
- 评分:${crossDomain.score}/100(置信度:${crossDomain.confidence})
- 探索领域:${crossDomain.exploredDomains?.join(", ") || "无"}
- 迁移总结:${truncate(crossDomain.transferSummary, 300)}
- 跨域桥梁 ${crossDomain.bridges.length} 条:
${crossDomain.bridges
  .slice(0, 3)
  .map((b, i) => `  ${i + 1}. ${b.sourceField} → ${b.targetField}: ${b.techPrinciple}(潜力 ${b.noveltyPotential}/100,出处: ${b.reference ?? "无"})`)
  .join("\n")}

**重要**:你必须核验跨域建议——引用的案例和出处是否可信?标记任何疑似编造或过度推测的主张。`
    : ""
}
---

## 系统自动计算

- **评分统计**:平均 ${avgScore},标准差 ${stdDev}
- **加权参考分**:${weightedReference}/100 ⚠️ 此值仅为机械加权参考,你必须基于自己的推理独立裁决最终分数,不要直接采用
- **检测到的冲突**:${conflicts.length > 0 ? conflicts.map((c) => `${c.a} vs ${c.b} 差异 ${c.diff} 分`).join(";") : "无显著冲突(所有评分差异 ≤ 20 分)"}
- **共识度预判**:${stdDev <= 10 ? "强共识" : stdDev <= 20 ? "中等共识" : "弱共识(分歧较大)"}
${
  debate?.triggered && debate.sessions.length > 0
    ? `
---

## 🔥 NovoDebate 对抗辩论记录

以下是 Agent 之间的对抗辩论结果,你**必须**在裁决中考虑这些发现(评分修正建议仅供参考,应基于辩论揭示的事实独立裁决):

${truncate(debate.dissentReportText, 2500)}`
    : ""
}
---

# 思维链(请按以下步骤逐步推理)

**Step 1 - 共识总结**:所有专家一致认同的核心结论
**Step 2 - 冲突裁决**:逐一处理检测到的冲突,给出你的判断
${debate?.triggered ? "**Step 2.5 - 辩论复盘**:NovoDebate 揭示了什么新洞察?评分修正是否合理?\n" : ""}${hasCrossDomain ? "**Step 2.8 - 跨域核验**:逐条评估跨域桥梁,哪些有真实迁移潜力、哪些是推测?\n" : ""}**Step 3 - 权重复核**:系统计算的权重是否合理?
**Step 4 - 综合评分**:基于独立推理给出最终分数(不要照抄加权参考分)
**Step 5 - 投资建议**:给出明确的建议等级和行动方案
**Step 6 - 撰写 Summary**:以结论判断开头,不要逐一转述各专家的话。正确示例:"**推荐(65分)**——该技术在学术创新性上有一定突破,市场存在明确需求,但竞争格局趋紧,建议优先申请专利保护后再进入市场。"错误示例:"学术审查员指出…产业分析员认为…"

---

# 评分标准

| 评分 | 建议 |
|------|------|
| ≥${T.stronglyRecommend} | 强烈推荐 |
| ${T.recommend}-${T.stronglyRecommend - 1} | 推荐 |
| ${T.caution}-${T.recommend - 1} | 谨慎考虑 |
| <${T.caution} | 不推荐 |

---

# 输出格式

${languageLine(input.language)}
⚠️ "YOUR_SCORE_HERE" 必须替换为你**独立裁决**的最终分数(0-100 整数,JSON 数字类型)。严禁直接采用系统加权参考分。
严格按以下 JSON 格式输出,不要有任何其他内容:
{
  "summary": "决策性结论:以【推荐等级】开头,2-3 句说明核心判断理由和行动方向。严禁逐一罗列各专家说了什么。",
  "overallScore": "YOUR_SCORE_HERE",
  "recommendation": "强烈推荐 或 推荐 或 谨慎考虑 或 不推荐",
  "consensusLevel": "${stdDev <= 10 ? "strong" : stdDev <= 20 ? "moderate" : "weak"}",
  "dissent": ["某位专家持明显不同意见时记录在此"],
  "conflictsResolved": ["冲突1的裁决(含商业现实纠偏记录)", "冲突2的裁决"],
  "nextSteps": ["行动1", "行动2", "行动3"]${
    hasCrossDomain
      ? `,
  "crossDomainVerification": {
    "overallAssessment": "对跨域建议整体质量与可信度的评估",
    "verifiedBridges": ["通过核验的桥梁描述"],
    "questionableClaims": ["疑似编造或需要更多证据的引用/案例"],
    "enhancedSuggestions": ["你基于分析补充的跨域迁移想法"]
  }`
      : ""
  }
}`;
}

/** 把预计算的加权明细装回结果(模型不再自报数字,保证透明数据准确)。 */
function buildWeightedBreakdown(input: Input, pre: Precomputed): ArbitrationResult["weightedBreakdown"] {
  const outputs: Record<AgentKey, AgentOutput> = {
    academic: input.academic,
    industry: input.industry,
    innovation: input.innovation,
    competitor: input.competitor,
  };
  const item = (k: AgentKey): WeightedScoreItem => ({
    raw: pre.scores[k],
    weight: pre.normalizedWeights[k],
    weighted: Math.round(pre.scores[k] * pre.normalizedWeights[k]),
    confidence: outputs[k].confidence,
  });
  return { academic: item("academic"), industry: item("industry"), innovation: item("innovation"), competitor: item("competitor") };
}

export const arbitratorTool: EngineTool<Input, ArbitrationResult> = {
  id: "agent.arbitration",
  category: "agent",
  title: { zh: "仲裁员", en: "Arbitrator" },
  description:
    "整合四位专家报告 + 辩论分歧 + 跨域核验,动态权重透明仲裁,产出最终评分、推荐等级与行动建议。输入创意 + 各 Agent 输出。",
  inputSchema,
  async execute(input, ctx) {
    const pre = precompute(input);
    const { text, usedModel } = await ctx.callAI({
      prompt: buildPrompt(input, pre),
      maxOutputTokens: 16_384, // strong 思考模型 reasoning 也占输出额度,给足
      timeoutMs: 140_000, // 低于编排器 arbitratorMs(150s)
      abortSignal: ctx.abortSignal,
    });
    const raw = parseAgentJSON<Partial<ArbitrationResult> & { overallScore?: unknown }>(text);

    const overallScore = clampScore(
      typeof raw.overallScore === "string" ? Number(raw.overallScore) : raw.overallScore,
      pre.weightedReference, // 模型没给分时退回机械加权参考(标 isPartial)
    );
    const stdDev = pre.stdDev;
    return {
      summary: typeof raw.summary === "string" && raw.summary ? raw.summary : "仲裁摘要缺失",
      overallScore,
      recommendation: typeof raw.recommendation === "string" ? raw.recommendation : "",
      conflictsResolved: asStringArray(raw.conflictsResolved),
      nextSteps: asStringArray(raw.nextSteps),
      isPartial: typeof raw.overallScore !== "number" && typeof raw.overallScore !== "string" ? true : undefined,
      usedModel,
      weightedBreakdown: buildWeightedBreakdown(input, pre),
      consensusLevel:
        raw.consensusLevel === "strong" || raw.consensusLevel === "moderate" || raw.consensusLevel === "weak"
          ? raw.consensusLevel
          : stdDev <= 10
            ? "strong"
            : stdDev <= 20
              ? "moderate"
              : "weak",
      dissent: asStringArray(raw.dissent),
      crossDomainVerification:
        raw.crossDomainVerification && typeof raw.crossDomainVerification === "object"
          ? {
              overallAssessment: String(raw.crossDomainVerification.overallAssessment ?? ""),
              verifiedBridges: asStringArray(raw.crossDomainVerification.verifiedBridges),
              questionableClaims: asStringArray(raw.crossDomainVerification.questionableClaims),
              enhancedSuggestions: asStringArray(raw.crossDomainVerification.enhancedSuggestions),
            }
          : undefined,
    };
  },
};

registerTool(arbitratorTool);
