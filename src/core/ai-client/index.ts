// AI 客户端统一出口。引擎其他层从 "@/core/ai-client" 导入。

export * from "./config";
export {
  callAI,
  callByTier,
  callVision,
  callWithFallback,
  checkCostLimit,
  isProviderAvailable,
  type AIResult,
  type CallOptions,
  type VisionImage,
} from "./call";
export { resolveModelName } from "./provider-registry";
export { parseAgentJSON, AgentJSONParseError } from "./parse";
export { withSemaphore, type Priority } from "./semaphore";
export { isCircuitOpen, recordFailure, recordSuccess } from "./circuit-breaker";
