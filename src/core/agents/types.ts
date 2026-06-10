// Agent 契约。每个分析角色实现 AgentDefinition.run,从 ctx 取依赖、产出自己的结果。
// 铁律③:Agent 无状态——只读 ctx,不持有跨调用状态。

import type { AgentInput, OnProgress } from "@/lib/types";
import type { AIResult, CallOptions, ProviderId } from "@/core/ai-client";

/** Agent 运行上下文(由 orchestrator 为每个 step 构造)。 */
export interface StepContext {
  /** 用户原始创意/长文 */
  query: string;
  /** 原始分析输入(检索结果、语言、领域等) */
  input: AgentInput;
  /** 已完成 step 的输出,按 step.id 索引(供后续层读取前序结果) */
  results: Record<string, unknown>;
  /** 该 step 解析后的默认 provider(由管线 step.model 决定) */
  provider: ProviderId;
  /** 该 step 解析后的模型覆盖 */
  model?: string;
  onProgress?: OnProgress;
  abortSignal?: AbortSignal;
  /** 模型调用能力(provider 默认取 ctx.provider,可覆盖);带降级链。 */
  callAI(opts: Omit<CallOptions, "provider"> & { provider?: ProviderId }): Promise<AIResult>;
}

/** Agent 定义。run 返回值类型随角色而异(AgentOutput / DebateRecord / ArbitrationResult …),
 *  由管线的 assemble 阶段按 step.id 取用并组装成 FinalReport。 */
export interface AgentDefinition {
  id: string;
  description?: string;
  run(ctx: StepContext): Promise<unknown>;
}
