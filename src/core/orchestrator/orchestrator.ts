// 通用分层调度引擎:读 PipelineDefinition 按层执行,本身不写死任何 Agent。
// 保留旧库精华:2/3 多数即进、关键路径 vs 后台、条件触发、时间预算、降级不崩、onProgress。

import type { AgentInput, FinalReport } from "@/lib/types";
import { getAgent, type StepContext } from "@/core/agents";
import {
  callWithFallback,
  TIMEOUTS,
  type CallOptions,
  type ProviderId,
} from "@/core/ai-client";
import { getTool, type ToolContext } from "@/core/tools";
import { getPipeline, type PipelineDefinition, type PipelineLayer, type PipelineStep } from "@/core/pipeline";
import { TimeBudget } from "./budget";
import { runWithTimeout, waitForN } from "./timeout";

// 总时间预算。阶段 5 实测:思考模型单 Agent 可达 90-110s,300s 会饿死末端仲裁,放宽到 8min。
const TOTAL_MAX_DURATION = 480_000;
const DEFAULT_PROVIDER: ProviderId = "deepseek"; // step 未指定 model 时的兜底

export interface RunPipelineOptions {
  pipeline: string | PipelineDefinition;
  input: AgentInput;
}

export async function runPipeline(opts: RunPipelineOptions): Promise<FinalReport> {
  const def = typeof opts.pipeline === "string" ? getPipeline(opts.pipeline) : opts.pipeline;
  const { input } = opts;
  const results: Record<string, unknown> = {};
  const budget = new TimeBudget(TOTAL_MAX_DURATION);
  const background: Array<Promise<unknown>> = []; // 后台/非关键 step,管线末尾汇合

  const emit = (
    event: "progress" | "log" | "agent_state" | "agent_thinking",
    data: Record<string, unknown> | string | number,
  ): void => {
    input.onProgress?.(event, data);
  };

  // 执行单个 step:写 results;失败/超时不抛(降级不崩)。
  const runStep = async (step: PipelineStep): Promise<void> => {
    if (step.condition && !step.condition(results)) {
      emit("log", `跳过 ${step.id}(触发条件未满足)`);
      return;
    }
    const provider = step.model?.provider ?? DEFAULT_PROVIDER;
    const callAI = (callOpts: Omit<CallOptions, "provider"> & { provider?: ProviderId }) =>
      callWithFallback({
        ...callOpts,
        provider: callOpts.provider ?? provider,
        model: callOpts.model ?? step.model?.model,
      });

    // step 执行体:toolRef(阶段 5 主路径,与 Agentic 共享工具)优先,agentRef 兼容 stub。
    const execute = (): Promise<unknown> => {
      if (step.toolRef) {
        const tool = getTool(step.toolRef);
        const toolCtx: ToolContext = {
          provider,
          model: step.model?.model,
          onProgress: input.onProgress,
          abortSignal: input.abortSignal,
          results,
          callAI,
        };
        const rawInput = step.mapInput ? step.mapInput(results, input) : { query: input.query };
        return tool.execute(tool.inputSchema.parse(rawInput), toolCtx);
      }
      if (!step.agentRef) {
        throw new Error(`step ${step.id} 既无 toolRef 也无 agentRef`);
      }
      const ctx: StepContext = {
        query: input.query,
        input,
        results,
        provider,
        model: step.model?.model,
        onProgress: input.onProgress,
        abortSignal: input.abortSignal,
        callAI,
      };
      return getAgent(step.agentRef).run(ctx);
    };

    // step 超时 = 自身上限(覆盖值或默认 agentMs)与剩余总预算取小,降级不崩由 catch 兜底。
    const timeoutMs = Math.max(1_000, Math.min(budget.remaining(), step.timeoutMs ?? TIMEOUTS.agentMs));
    emit("agent_state", { agentId: step.id, status: "running" });
    try {
      results[step.id] = await runWithTimeout(execute, timeoutMs, step.id);
      emit("agent_state", { agentId: step.id, status: "done" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit("log", `${step.id} 失败/超时(标记部分结果): ${msg}`);
      emit("agent_state", { agentId: step.id, status: "failed" });
    }
  };

  const runParallelLayer = async (layer: PipelineLayer): Promise<void> => {
    const active = layer.steps.filter((s) => !s.condition || s.condition(results));
    const criticalPromises: Array<Promise<void>> = [];
    for (const step of active) {
      const p = runStep(step);
      if (step.critical) criticalPromises.push(p);
      else background.push(p); // 非关键:后台跑,不阻塞推进
    }
    // 关键路径达到多数即推进;剩余关键 step 也转后台。
    const need = layer.majority ?? criticalPromises.length;
    await waitForN(criticalPromises, need);
    background.push(...criticalPromises);
  };

  const runSerialLayer = async (layer: PipelineLayer): Promise<void> => {
    for (const step of layer.steps) {
      await runStep(step);
    }
  };

  for (let i = 0; i < def.layers.length; i++) {
    const layer = def.layers[i];
    emit("log", `进入 ${layer.id}(${layer.mode})`);
    if (layer.mode === "parallel") await runParallelLayer(layer);
    else await runSerialLayer(layer);
    emit("progress", Math.round(((i + 1) / def.layers.length) * 95));
  }

  // 汇合所有后台/非关键 step,确保 assemble 拿到尽可能完整的结果。
  await Promise.allSettled(background);

  const report = def.assemble(results, { language: input.language, query: input.query });
  emit("progress", 100);
  emit("log", "管线执行完成");
  return report;
}
