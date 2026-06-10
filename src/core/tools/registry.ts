// 工具注册表(热插拔)。检索源、子 Agent 都注册到这里;
// 固定管线按 id 引用,Agentic 模式按 category 枚举后转 AI SDK tool。

import type { AnyEngineTool, EngineTool, ToolCategory } from "./types";

const registry = new Map<string, AnyEngineTool>();

export function registerTool<I, O>(tool: EngineTool<I, O>): void {
  registry.set(tool.id, tool);
}

export function getTool(id: string): AnyEngineTool {
  const tool = registry.get(id);
  if (!tool) throw new Error(`工具未注册: ${id}`);
  return tool;
}

export function hasTool(id: string): boolean {
  return registry.has(id);
}

export function listTools(category?: ToolCategory): AnyEngineTool[] {
  const all = [...registry.values()];
  return category ? all.filter((t) => t.category === category) : all;
}
