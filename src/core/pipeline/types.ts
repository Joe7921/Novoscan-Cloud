// 管线契约(铁律①:管线是一等公民——可声明、可版本化、可热插拔)。
// 把"分析流程"抽象成数据:哪几层、并行还是串行、调哪些 Agent、谁是关键路径、
// 什么条件触发、每个 step 用哪个模型、评分权重多少——全部声明在配方里。

import type { AgentInput, FinalReport, Language, LocalizedText } from "@/lib/types";
import type { ProviderId } from "@/core/ai-client";

/** step 使用的模型(provider + 可选模型名覆盖)。 */
export interface ModelSpec {
  provider: ProviderId;
  model?: string;
}

export interface PipelineStep {
  id: string; // 结果索引键(assemble 按此取用)
  /** 引用已注册的 EngineTool id(阶段 5 起的主路径,与 Agentic 模式共享同一套工具) */
  toolRef?: string;
  /** 工具入参映射:从前序结果 + 原始输入构造该工具的 input(缺省只传 { query }) */
  mapInput?: (results: Record<string, unknown>, input: AgentInput) => unknown;
  /** 引用已注册的 Agent id(阶段 3 旧路径,保留以兼容 stub;toolRef 优先) */
  agentRef?: string;
  model?: ModelSpec; // 缺省时 orchestrator 给默认 provider
  critical?: boolean; // 关键路径(参与 2/3 多数);否则后台非阻塞
  condition?: (results: Record<string, unknown>) => boolean; // 条件触发(如辩论)
  timeoutMs?: number; // 该 step 超时覆盖
}

export type LayerMode = "parallel" | "serial";

export interface PipelineLayer {
  id: string;
  mode: LayerMode;
  steps: PipelineStep[];
  majority?: number; // 并行层"N 个真实(非降级)完成即进下一层"
}

/** 仲裁加权权重。 */
export interface ScoringWeights {
  academic: number;
  industry: number;
  innovation: number;
  competitor: number;
}

/** 插件槽(铁律④:插件契约与沙箱早立规矩,本期仅占位声明)。 */
export interface PipelinePluginSlot {
  id: string;
  enabled: boolean;
}

export interface PipelineDefinition {
  id: string;
  version: string;
  type: string; // 如 "通用型"
  name: LocalizedText;
  description: LocalizedText;
  layers: PipelineLayer[];
  scoring?: ScoringWeights;
  plugins?: PipelinePluginSlot[];
  /** 把各 step 结果(按 step.id)组装成最终报告。 */
  assemble(
    results: Record<string, unknown>,
    ctx: { language: Language; query: string },
  ): FinalReport;
}
