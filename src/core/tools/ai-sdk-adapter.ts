// 适配器:把 EngineTool 转成 Vercel AI SDK 的 tool,供 Agentic 模式(第3步)
// 交给主控 AI 自主调度。本期仅提供能力,Agentic 模式尚未启用。

import { tool, type Tool } from "ai";
import type { AnyEngineTool, ToolContext } from "./types";

/** 单个 EngineTool → AI SDK tool。 */
export function toAISDKTool(engineTool: AnyEngineTool, ctx: ToolContext): Tool {
  return tool({
    description: engineTool.description,
    inputSchema: engineTool.inputSchema,
    execute: (input: unknown) => engineTool.execute(input, ctx),
  });
}

/** 一组 EngineTool → AI SDK toolset(键名做安全化,工具 id 里的非词字符转下划线)。 */
export function toAISDKToolSet(
  tools: AnyEngineTool[],
  ctx: ToolContext,
): Record<string, Tool> {
  const set: Record<string, Tool> = {};
  for (const t of tools) {
    set[t.id.replace(/[^\w]/g, "_")] = toAISDKTool(t, ctx);
  }
  return set;
}
