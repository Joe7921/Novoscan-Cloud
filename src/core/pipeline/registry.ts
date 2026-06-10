// 管线注册表(热插拔)。将来 Studio/市场的自制管线在此注册即可被引擎调用。

import type { PipelineDefinition } from "./types";

const pipelines = new Map<string, PipelineDefinition>();

export function registerPipeline(pipeline: PipelineDefinition): void {
  pipelines.set(pipeline.id, pipeline);
}

export function getPipeline(id: string): PipelineDefinition {
  const pipeline = pipelines.get(id);
  if (!pipeline) throw new Error(`管线未注册: ${id}`);
  return pipeline;
}

export function hasPipeline(id: string): boolean {
  return pipelines.has(id);
}

export function listPipelines(): PipelineDefinition[] {
  return [...pipelines.values()];
}
