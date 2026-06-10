// Provider 级熔断器:连续失败 2 次 → 冷却 5min → 之后半开(允许一次探测)。
// 沿用旧库 ai-client.ts 的熔断逻辑。

import { CIRCUIT, type ProviderId } from "./config";

interface CircuitState {
  consecutiveFailures: number;
  lastFailureAt: number;
}

const circuits = new Map<ProviderId, CircuitState>();

/** 是否处于熔断(开)状态。冷却期内=开(跳过);冷却期已过=半开(放行一次探测)。 */
export function isCircuitOpen(id: ProviderId): boolean {
  const s = circuits.get(id);
  if (!s || s.consecutiveFailures < CIRCUIT.failureThreshold) return false;
  return Date.now() - s.lastFailureAt < CIRCUIT.cooldownMs;
}

export function recordFailure(id: ProviderId): void {
  const s = circuits.get(id) ?? { consecutiveFailures: 0, lastFailureAt: 0 };
  s.consecutiveFailures += 1;
  s.lastFailureAt = Date.now();
  circuits.set(id, s);
}

/** 成功即清空熔断状态(半开探测成功后恢复)。 */
export function recordSuccess(id: ProviderId): void {
  circuits.delete(id);
}
