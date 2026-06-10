// 工具层统一契约(双轨架构的地基)。
// 平台每个"能干活的单元"——检索源、子 Agent——都实现 EngineTool。
// 一套工具两种开法:① 固定管线(可信模式)按配方调 execute;② Agentic(灵活模式,第3步)
// 把工具转成 AI SDK tool 交给主控 AI 自主调度。execute 同一个,零重复。

import type { ZodType } from "zod";
import type { LocalizedText, OnProgress } from "@/lib/types";
import type { AIResult, CallOptions, ProviderId } from "@/core/ai-client";

export type ToolCategory = "datasource" | "agent" | "utility";

/** 工具执行上下文(管线与 Agentic 两种模式共用)。 */
export interface ToolContext {
  provider?: ProviderId;
  model?: string;
  onProgress?: OnProgress;
  abortSignal?: AbortSignal;
  /** 已完成结果(管线模式下工具可读前序;Agentic 模式通常为空) */
  results?: Record<string, unknown>;
  /** 模型调用能力(子 Agent 工具用),带降级链。 */
  callAI(opts: Omit<CallOptions, "provider"> & { provider?: ProviderId }): Promise<AIResult>;
}

/** 引擎工具:平台能力的统一封装。I=入参类型,O=产出类型。 */
export interface EngineTool<I = unknown, O = unknown> {
  id: string; // 唯一标识,如 "search.academic"、"agent.academic-reviewer"
  category: ToolCategory;
  title: LocalizedText; // 人类可读名
  description: string; // 给主控 AI 看的用途说明(Agentic 模式 tool description)
  inputSchema: ZodType<I>; // 入参 schema:校验 + 生成 AI SDK tool
  execute(input: I, ctx: ToolContext): Promise<O>;
}

// 注册表/适配器处理异构工具(各自 I/O 不同),此处的 any 是合理的——
// 每个工具自带 inputSchema 做运行时校验,类型安全在工具内部保证。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEngineTool = EngineTool<any, any>;
