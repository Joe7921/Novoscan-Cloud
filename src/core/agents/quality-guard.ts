// 质量把关(L4,纯逻辑零 AI):对仲裁结果与各 Agent 输出做一致性体检。
// 参考旧库 qualityGuard.ts 重写为 EngineTool。检查:字段完整性 / 评分合法性 /
// 评分-建议一致性 / 离散度 / 置信度匹配 / 证据覆盖 / fallback 检测 / 辩论质量 / 自动修正。

import { z } from "zod";
import type { AgentOutput, ArbitrationResult, DebateRecord, QualityCheckResult } from "@/lib/types";
import { registerTool, type EngineTool } from "@/core/tools";
import { RECOMMENDATION_THRESHOLDS, mapScoreToRecommendation } from "./shared";

const inputSchema = z.object({
  arbitration: z.custom<ArbitrationResult>((v) => !!v && typeof v === "object").describe("仲裁结果"),
  agents: z
    .array(z.custom<AgentOutput>((v) => !!v && typeof v === "object"))
    .describe("参与裁决的各 Agent 输出(学术/产业/创新/竞品)"),
  debate: z.custom<DebateRecord>((v) => !v || typeof v === "object").optional().describe("辩论记录"),
});
type Input = z.infer<typeof inputSchema>;

function check(input: Input): QualityCheckResult {
  const { arbitration, agents, debate } = input;
  const issues: string[] = [];
  const warnings: string[] = [];
  let consistencyScore = 100; // 满分开始,扣分制

  // 1. 基础字段完整性
  if (typeof arbitration.overallScore !== "number" || arbitration.overallScore < 0 || arbitration.overallScore > 100) {
    issues.push(`综合评分超出有效范围 (0-100): ${arbitration.overallScore}`);
  }
  if (!arbitration.summary || arbitration.summary.trim().length < 10) {
    issues.push("综合摘要缺失或过短(至少 10 字符)");
  }
  if (!arbitration.recommendation || arbitration.recommendation.trim().length === 0) {
    issues.push("缺少最终建议");
  }
  const validRecommendations = [
    "强烈推荐", "推荐", "谨慎考虑", "不推荐",
    "Strongly Recommended", "Recommended", "Proceed with Caution", "Not Recommended",
  ];
  if (arbitration.recommendation && !validRecommendations.some((v) => arbitration.recommendation.includes(v))) {
    warnings.push(`建议值不在预期范围内: "${arbitration.recommendation}"`);
  }
  if (!Array.isArray(arbitration.nextSteps) || arbitration.nextSteps.length === 0) {
    issues.push("缺少下一步行动建议");
  }
  if (!Array.isArray(arbitration.conflictsResolved)) {
    warnings.push("缺少冲突解决记录");
  }

  // 2. 评分 vs 建议等级一致性
  const score = arbitration.overallScore;
  const rec = arbitration.recommendation ?? "";
  if (typeof score === "number") {
    if (score >= RECOMMENDATION_THRESHOLDS.stronglyRecommend && rec.includes("不推荐")) {
      issues.push(`逻辑矛盾:综合评分 ${score} ≥ ${RECOMMENDATION_THRESHOLDS.stronglyRecommend} 但建议为"不推荐"`);
    }
    if (score < RECOMMENDATION_THRESHOLDS.caution && (rec.includes("强烈推荐") || rec === "推荐" || rec === "Recommended")) {
      issues.push(`逻辑矛盾:综合评分 ${score} < ${RECOMMENDATION_THRESHOLDS.caution} 但建议为"${rec}"`);
    }
  }

  // 3. 各 Agent 评分离散度(共识度)
  const realScores = agents.filter((a) => typeof a.score === "number" && a.confidence !== "low").map((a) => a.score);
  if (realScores.length >= 2) {
    const avg = realScores.reduce((a, b) => a + b, 0) / realScores.length;
    const stdDev = Math.sqrt(realScores.reduce((s, v) => s + (v - avg) ** 2, 0) / realScores.length);
    if (stdDev > 25) {
      warnings.push(`专家评分离散度极高(标准差 ${Math.round(stdDev)}),共识度低`);
      consistencyScore -= 30;
    } else if (stdDev > 15) {
      warnings.push(`专家评分存在较大分歧(标准差 ${Math.round(stdDev)})`);
      consistencyScore -= 15;
    }
    if (Math.max(...realScores) - Math.min(...realScores) > 40) {
      warnings.push(`评分极差达 ${Math.max(...realScores) - Math.min(...realScores)} 分,建议关注分歧原因`);
      consistencyScore -= 10;
    }
  }

  // 4. 置信度 vs 评分一致性
  for (const agent of agents) {
    if (agent.confidence === "high" && agent.score < 20) {
      warnings.push(`${agent.agentName}:高置信度但评分极低 (${agent.score}),可能存在评判偏差`);
      consistencyScore -= 5;
    }
    if (agent.confidence === "low" && agent.score > 80) {
      warnings.push(`${agent.agentName}:低置信度但评分极高 (${agent.score}),数据支撑不足`);
      consistencyScore -= 10;
    }
  }

  // 5. 证据覆盖率
  const withEvidence = agents.filter((a) => Array.isArray(a.evidenceSources) && a.evidenceSources.length > 0).length;
  if (withEvidence === 0) {
    warnings.push("所有 Agent 均未提供证据来源引用");
    consistencyScore -= 15;
  } else if (withEvidence < agents.length) {
    warnings.push(`${agents.length - withEvidence} 个 Agent 未提供证据来源引用`);
    consistencyScore -= 5;
  }

  // 5.5 高分-证据一致性(高分空口无凭检测)
  for (const agent of agents) {
    if (agent.score > 80) {
      const evidenceCount = agent.evidenceSources?.length ?? 0;
      if (evidenceCount === 0 && agent.confidence === "high") {
        issues.push(`${agent.agentName}:评分 ${agent.score} 且置信度高,但未提供任何证据来源(高分空口无凭)`);
        consistencyScore -= 15;
      } else if (evidenceCount < 2) {
        warnings.push(`${agent.agentName}:评分 ${agent.score} > 80 但仅 ${evidenceCount} 条证据来源,数据支撑不足`);
        consistencyScore -= 5;
      }
    }
  }

  // 5.6 fallback 降级检测
  const fallbackAgents = agents.filter((a) => a.isFallback);
  if (fallbackAgents.length > 0) {
    issues.push(
      `${fallbackAgents.length} 个 Agent 使用了降级数据(${fallbackAgents.map((a) => a.agentName).join("、")}),报告可靠性受限`,
    );
    consistencyScore -= fallbackAgents.length * 15;
  }

  // 6. 推理留痕
  if (agents.filter((a) => a.reasoning && a.reasoning.trim().length > 20).length === 0) {
    warnings.push("所有 Agent 均未提供推理过程");
    consistencyScore -= 10;
  }

  // 7. 加权明细
  if (arbitration.weightedBreakdown) {
    const wb = arbitration.weightedBreakdown;
    const totalWeight = wb.academic.weight + wb.industry.weight + wb.innovation.weight + wb.competitor.weight;
    if (Math.abs(totalWeight - 1.0) > 0.05) {
      warnings.push(`加权权重之和 ${totalWeight.toFixed(2)} 不等于 1.0`);
    }
  } else {
    warnings.push("仲裁结果缺少加权评分明细");
  }

  // 8. NovoDebate 辩论质量
  if (debate) {
    const allScores = agents.filter((a) => typeof a.score === "number").map((a) => a.score);
    if (allScores.length >= 2) {
      const maxDiff = Math.max(...allScores) - Math.min(...allScores);
      if (maxDiff > 30 && !debate.triggered) {
        warnings.push(`专家评分极差达 ${maxDiff} 分但未触发 NovoDebate 辩论`);
      }
    }
    if (debate.triggered) {
      for (const session of debate.sessions) {
        const adj = session.scoreAdjustment;
        if (Math.abs(adj.proAgentDelta) > 15 || Math.abs(adj.conAgentDelta) > 15) {
          warnings.push(`辩论场次 ${session.sessionId} 评分修正幅度过大(超过 ±15)`);
          consistencyScore -= 5;
        }
      }
      const empty = debate.sessions.filter((s) => s.exchanges.length === 0).length;
      if (empty > 0) warnings.push(`${empty} 场辩论未产出有效交锋记录`);
    }
  }

  consistencyScore = Math.max(0, Math.min(100, consistencyScore));

  // 9. 自动修正:评分与推荐等级严重矛盾时按阈值重新映射
  const corrections: QualityCheckResult["corrections"] = [];
  if (typeof score === "number" && arbitration.recommendation) {
    const expected = mapScoreToRecommendation(score);
    const isContradiction =
      (score >= RECOMMENDATION_THRESHOLDS.stronglyRecommend && rec.includes("不推荐")) ||
      (score < RECOMMENDATION_THRESHOLDS.caution && (rec.includes("强烈推荐") || rec === "推荐"));
    if (isContradiction) {
      corrections.push({
        field: "recommendation",
        from: rec,
        to: expected,
        reason: `评分 ${score} 与推荐等级"${rec}"矛盾,按阈值重新映射为"${expected}"`,
      });
    }
  }

  return { passed: issues.length === 0, issues, warnings, consistencyScore, corrections };
}

export const qualityGuardTool: EngineTool<Input, QualityCheckResult> = {
  id: "agent.quality",
  category: "agent",
  title: { zh: "质量把关", en: "Quality Guard" },
  description: "纯逻辑一致性体检(零 AI 调用):字段完整性、评分-建议一致性、共识度、证据覆盖、降级检测与自动修正。",
  inputSchema,
  execute: async (input) => check(input),
};

registerTool(qualityGuardTool);
