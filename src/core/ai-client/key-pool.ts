// API Key 池:每 provider 支持多 Key(环境变量值用逗号分隔),挑"最空闲且健康"的 Key;
// Key 级失败短冷却,自动 failover。
// 支持给每把 Key 加备注标签:格式 "标签=key"(逗号分隔多把,各带各的备注)。
// 标签仅用于日志/排查,绝不暴露完整 key。无标签时用尾 4 位掩码。

import { PROVIDERS, type ProviderId } from "./config";

const KEY_COOLDOWN_MS = 60_000; // Key 失败后的冷却窗口

interface KeyState {
  key: string;
  label: string; // 备注标签(用户指定或掩码),仅日志用
  inFlight: number;
  failedAt: number;
}

const pools = new Map<ProviderId, KeyState[]>();

function maskKey(key: string): string {
  return `***${key.slice(-4)}`;
}

// 解析一项:"标签=key" → {label, key};纯 "key" → {label: 掩码, key}。
function parseEntry(entry: string): KeyState {
  const eq = entry.indexOf("=");
  if (eq > 0) {
    const label = entry.slice(0, eq).trim();
    const key = entry.slice(eq + 1).trim();
    if (key) return { key, label: label || maskKey(key), inFlight: 0, failedAt: 0 };
  }
  return { key: entry, label: maskKey(entry), inFlight: 0, failedAt: 0 };
}

function loadKeys(id: ProviderId): KeyState[] {
  const raw = process.env[PROVIDERS[id].envApiKey] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseEntry);
}

function getPool(id: ProviderId): KeyState[] {
  let pool = pools.get(id);
  if (!pool) {
    pool = loadKeys(id);
    pools.set(id, pool);
  }
  return pool;
}

/** 该 provider 是否配置了至少一个 Key。 */
export function hasKey(id: ProviderId): boolean {
  return getPool(id).length > 0;
}

export interface KeyHandle {
  key: string;
  label: string; // 命中的 key 备注标签(日志用)
  release(): void;
  markFailure(): void;
}

/** 取一个可用 Key(挑最空闲且未在冷却的)。用完必须 release()。 */
export function acquireKey(id: ProviderId): KeyHandle {
  const pool = getPool(id);
  if (pool.length === 0) {
    throw new Error(`Provider ${id} 未配置 API Key(环境变量 ${PROVIDERS[id].envApiKey})`);
  }
  const now = Date.now();
  const healthy = pool.filter((k) => now - k.failedAt >= KEY_COOLDOWN_MS);
  const candidates = healthy.length > 0 ? healthy : pool;
  const chosen = candidates.reduce((a, b) => (b.inFlight < a.inFlight ? b : a));
  chosen.inFlight += 1;

  let released = false;
  return {
    key: chosen.key,
    label: chosen.label,
    release() {
      if (!released) {
        released = true;
        chosen.inFlight = Math.max(0, chosen.inFlight - 1);
      }
    },
    markFailure() {
      chosen.failedAt = Date.now();
    },
  };
}
