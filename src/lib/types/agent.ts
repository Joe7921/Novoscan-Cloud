// 多 Agent 分析的输入/输出契约
// 参考旧库 src/agents/types.ts 重写。阶段 5 各 Agent 实现这些契约。
// 铁律②:onProgress 是引擎内部进度回调(非界面耦合),由调用方(API 层)转成 SSE。

import type {
  ConfidenceLevel,
  Language,
  ModelProvider,
} from "./common";
import type { AcademicResult, IndustryResult } from "./search";

/** 引擎进度事件类型(API 层据此转 SSE) */
export type ProgressEvent =
  | "log"
  | "progress"
  | "agent_state"
  | "agent_stream"
  | "agent_thinking"
  | "agent_memory";

/** 进度回调签名 */
export type OnProgress = (
  event: ProgressEvent,
  data: Record<string, unknown> | string | number,
) => void;

/** Agent 统一输入 */
export interface AgentInput {
  query: string; // 用户原始创意/长文
  academicData: AcademicResult; // 学术检索结果
  industryData: IndustryResult; // 产业检索结果
  language: Language;
  modelProvider: ModelProvider;
  onProgress?: OnProgress;
  /** 编排器超时取消信号,传递给底层 AI 调用 */
  abortSignal?: AbortSignal;
  /** 学科领域提示(可选),用于注入 Agent Prompt */
  domainId?: string;
  subDomainId?: string;
  domainHint?: string;
  /** RAG 检索到的相关历史经验上下文(记忆层注入) */
  memoryContext?: string;
  /** 评分模式 Profile ID(如 'academic-deep') */
  scoringProfileId?: string;
}

/** 多维评分维度 */
export interface DimensionScore {
  name: string;
  score: number; // 0-100
  reasoning: string;
}

/** NovoStarchart 六维创新性雷达图维度 */
export interface InnovationRadarDimension {
  key: string; // 维度标识键(如 'techBreakthrough')
  nameZh: string;
  nameEn: string;
  score: number; // 0-100
  reasoning: string;
}

/** 学术审查员评估出的高相似度论文(AI 语义相似度,可点溯源) */
export interface SimilarPaper {
  title: string;
  year: number | string;
  similarityScore: number; // 0-100
  keyDifference: string; // 与用户创意的核心差异
  description?: string;
  authors?: string;
  url?: string;
  citationCount?: number;
  venue?: string;
  authorityLevel?: ConfidenceLevel; // 权威度
}

/** Agent 通用输出 */
export interface AgentOutput {
  agentName: string;
  analysis: string; // 完整分析文本
  score: number; // 0-100 综合评分
  confidence: ConfidenceLevel;
  confidenceReasoning: string; // 置信度理由
  keyFindings: string[];
  redFlags: string[];
  evidenceSources: string[]; // 引用的原始数据来源
  reasoning: string; // 推理过程(CoT 留痕)
  dimensionScores: DimensionScore[];
  /** 超时/异常降级的 fallback 结果标记(区别于 AI 正常返回的低置信) */
  isFallback?: boolean;
  /** 六维创新性雷达图(仅创新评估师输出) */
  innovationRadar?: InnovationRadarDimension[];
  /** 高相似度论文(仅学术审查员输出) */
  similarPapers?: SimilarPaper[];
}

// ==================== 跨域创新迁移引擎 ====================

/** 跨域桥梁节点 — 连接不同领域的技术原理 */
export interface CrossDomainBridge {
  sourceField: string;
  targetField: string;
  techPrinciple: string;
  sourceExample: string;
  targetExample: string;
  reference?: string;
  transferPath: string;
  noveltyPotential: number; // 0-100
  feasibility: ConfidenceLevel;
  riskLevel: "low" | "medium" | "high";
}

/** 跨域知识图谱节点 */
export interface KnowledgeGraphNode {
  id: string;
  label: string;
  field: string;
  type: "technology" | "application" | "principle";
}

/** 跨域知识图谱边 */
export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relation: "same_principle" | "analogous" | "evolved_from" | "inspires";
  strength: number; // 0-1
}

/** 跨域侦察兵 Agent 输出 */
export interface CrossDomainScoutOutput extends AgentOutput {
  bridges: CrossDomainBridge[];
  knowledgeGraph: {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  };
  exploredDomains: string[];
  transferSummary: string;
}
