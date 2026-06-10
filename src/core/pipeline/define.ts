// 管线定义辅助。definePipeline 仅做轻量校验并原样返回(便于类型推断与未来扩展)。

import type { PipelineDefinition } from "./types";

export function definePipeline(def: PipelineDefinition): PipelineDefinition {
  if (!def.id) throw new Error("管线缺少 id");
  if (def.layers.length === 0) throw new Error(`管线 ${def.id} 没有任何层`);
  const stepIds = new Set<string>();
  for (const layer of def.layers) {
    for (const step of layer.steps) {
      if (stepIds.has(step.id)) {
        throw new Error(`管线 ${def.id} 存在重复 step id: ${step.id}`);
      }
      stepIds.add(step.id);
    }
  }
  return def;
}
