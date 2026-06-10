// Agent 注册表(热插拔)。管线 step 通过 agentRef 引用已注册的 Agent。

import type { AgentDefinition } from "./types";

const registry = new Map<string, AgentDefinition>();

export function registerAgent(agent: AgentDefinition): void {
  registry.set(agent.id, agent);
}

export function getAgent(id: string): AgentDefinition {
  const agent = registry.get(id);
  if (!agent) throw new Error(`Agent 未注册: ${id}`);
  return agent;
}

export function hasAgent(id: string): boolean {
  return registry.has(id);
}

export function listAgents(): AgentDefinition[] {
  return [...registry.values()];
}
