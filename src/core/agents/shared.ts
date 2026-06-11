// 真 Agent 公共辅助:文本截断、输出归一化(治 GIGO)、推荐等级阈值、语言指令。
// 参考旧库各 Agent 文件中的散落工具函数,集中一处。

import type {
  AgentOutput,
  ConfidenceLevel,
  DimensionScore,
  Language,
} from "@/lib/types";

/** 推荐等级阈值(仲裁/质检共用;将来可由评分配置插件覆盖)。 */
export const RECOMMENDATION_THRESHOLDS = {
  stronglyRecommend: 80,
  recommend: 65,
  caution: 45,
} as const;

/** 评分 → 推荐等级映射(质检自动修正用)。 */
export function mapScoreToRecommendation(score: number): string {
  if (score >= RECOMMENDATION_THRESHOLDS.stronglyRecommend) return "强烈推荐";
  if (score >= RECOMMENDATION_THRESHOLDS.recommend) return "推荐";
  if (score >= RECOMMENDATION_THRESHOLDS.caution) return "谨慎考虑";
  return "不推荐";
}

/** 截断文本,超出部分用省略号(控制 prompt 体积)。 */
export function truncate(text: string | undefined, maxLen: number): string {
  if (!text) return "无";
  return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…(已截断)`;
}

/** 截断字符串数组(限制条数与单条长度)。 */
export function truncateList(items: string[] | undefined, maxItems: number, maxItemLen: number): string {
  if (!items || items.length === 0) return "无";
  return items.slice(0, maxItems).map((s) => truncate(s, maxItemLen)).join(" | ");
}

export function clampScore(value: unknown, fallback = 50): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

export function asConfidence(value: unknown, fallback: ConfidenceLevel = "low"): ConfidenceLevel {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asDimensionScores(value: unknown): DimensionScore[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => ({
      name: typeof d.name === "string" ? d.name : "未命名维度",
      score: clampScore(d.score),
      reasoning: typeof d.reasoning === "string" ? d.reasoning : "",
    }));
}

/** AI 返回的 AgentOutput 归一化:补默认值、夹评分、滤脏数组(垃圾出口最后一道闸)。 */
export function normalizeAgentOutput(raw: Partial<AgentOutput>, agentName: string): AgentOutput {
  return {
    ...raw, // 保留 similarPapers / innovationRadar 等扩展字段,下方再覆写核心字段
    agentName: raw.agentName || agentName,
    analysis: typeof raw.analysis === "string" ? raw.analysis : "",
    score: clampScore(raw.score),
    confidence: asConfidence(raw.confidence),
    confidenceReasoning: typeof raw.confidenceReasoning === "string" ? raw.confidenceReasoning : "",
    keyFindings: asStringArray(raw.keyFindings),
    redFlags: asStringArray(raw.redFlags),
    evidenceSources: asStringArray(raw.evidenceSources),
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
    dimensionScores: asDimensionScores(raw.dimensionScores),
  };
}

/** 输出语言指令(旧库 prompt 固定中文;新库随用户界面语言输出)。 */
export function languageLine(language: Language): string {
  return language === "en"
    ? "All free-text fields in the JSON (analysis/reasoning/findings/...) MUST be written in English."
    : "JSON 中所有自由文本字段(analysis/reasoning/findings 等)必须用简体中文撰写。";
}

/** 领域提示注入块(用户指定学科领域时约束分析视角)。 */
export function domainBlock(domainHint?: string, extra?: string): string {
  if (!domainHint) return "";
  return `
**用户指定学科领域**:${domainHint}
⚠️ 用户已明确指定所属学科领域,请以该领域的专业范式、标杆与评判标准为基准分析;检索结果中与该领域无关的条目应降低权重。${extra ?? ""}
`;
}

/** 记忆上下文注入块(阶段 6 RAG 接入后生效;当前透传可选字段)。 */
export function memoryBlock(memoryContext?: string): string {
  if (!memoryContext) return "";
  return `
## 历史经验参考(Agent Memory)
以下是平台积累的相关历史经验,分析时参考但不要盲从:
${memoryContext}
`;
}

/** 截断安全 + 防示例复制的通用输出要求(各 Agent prompt 复用)。 */
export const OUTPUT_RULES = `
⚠️ **关键要求**:以下仅为 JSON **结构**示例。所有 0(零)占位的 score 必须替换为你**独立推理**得出的真实数值(0-100 整数)。严禁复制示例中的任何数字;不同创意应产生显著不同的评分。
⚠️ **score 字段必须是 JSON 数字类型**(如 65),绝对不能用引号包裹。
⚠️ **字段顺序(截断安全设计)**:输出可能因 token 限制被截断,请严格按示例字段顺序输出——score、confidence 最先,analysis、dimensionScores 次之,reasoning 放在 JSON 最末尾(即使被截断也不影响评分)。
严格按 JSON 格式输出,不要有任何其他内容:`;
