"use client";

// 分析板块的 SSE 消费 Hook:发起 /api/analyze,解析流事件,驱动三态状态机。
// 引擎/界面分离(铁律②):本 Hook 只消费 AnalyzeStreamEvent,不含业务逻辑。

import { useCallback, useReducer, useRef } from "react";
import type { DualTrackResult, FinalReport } from "@/lib/types";
import type { AnalyzePhase, AnalyzeRequest, AnalyzeStreamEvent } from "./types";

/** Agent 卡固定展示顺序(对应管线 step id = agent_state.agentId)。 */
export const AGENT_ORDER = [
  "academic",
  "industry",
  "competitor",
  "crossDomain",
  "innovation",
  "debate",
  "arbitration",
  "quality",
] as const;
export type AgentId = (typeof AGENT_ORDER)[number];

export type AgentStatus = "pending" | "running" | "done" | "failed";
export interface AgentUiState {
  status: AgentStatus;
  thinking?: string; // 有 agent_thinking 流时的实时思考(打字机)
}

export type AnalyzeStatus = "idle" | "analyzing" | "done" | "error";

export interface AnalyzeState {
  status: AnalyzeStatus;
  phase: AnalyzePhase | null;
  progress: number;
  agents: Record<AgentId, AgentUiState>;
  logs: string[];
  search: Extract<AnalyzeStreamEvent, { type: "search" }> | null;
  memory: Extract<AnalyzeStreamEvent, { type: "memory" }> | null;
  report: FinalReport | null;
  dualTrack: DualTrackResult | null;
  fromCache: boolean;
  elapsedMs: number;
  error: string | null;
}

const LOG_CAP = 60;

function initialAgents(): Record<AgentId, AgentUiState> {
  return AGENT_ORDER.reduce(
    (acc, id) => ({ ...acc, [id]: { status: "pending" as AgentStatus } }),
    {} as Record<AgentId, AgentUiState>,
  );
}

function initialState(): AnalyzeState {
  return {
    status: "idle",
    phase: null,
    progress: 0,
    agents: initialAgents(),
    logs: [],
    search: null,
    memory: null,
    report: null,
    dualTrack: null,
    fromCache: false,
    elapsedMs: 0,
    error: null,
  };
}

type Action =
  | { kind: "start" }
  | { kind: "event"; event: AnalyzeStreamEvent }
  | { kind: "fail"; message: string }
  | { kind: "reset" };

const isAgentId = (id: string): id is AgentId => (AGENT_ORDER as readonly string[]).includes(id);

function reduce(state: AnalyzeState, action: Action): AnalyzeState {
  switch (action.kind) {
    case "start":
      return { ...initialState(), status: "analyzing" };
    case "reset":
      return initialState();
    case "fail":
      return { ...state, status: "error", error: action.message };
    case "event": {
      const e = action.event;
      switch (e.type) {
        case "phase":
          return { ...state, phase: e.phase };
        case "progress":
          return { ...state, progress: e.value };
        case "log":
          return { ...state, logs: [...state.logs, e.message].slice(-LOG_CAP) };
        case "agent_state": {
          if (!isAgentId(e.agentId)) return state;
          const status: AgentStatus =
            e.status === "done" ? "done" : e.status === "failed" ? "failed" : "running";
          return { ...state, agents: { ...state.agents, [e.agentId]: { ...state.agents[e.agentId], status } } };
        }
        case "agent_thinking": {
          if (!e.agentId || !isAgentId(e.agentId)) return state;
          const prev = state.agents[e.agentId];
          return {
            ...state,
            agents: { ...state.agents, [e.agentId]: { ...prev, thinking: (prev.thinking ?? "") + e.text } },
          };
        }
        case "search":
          return { ...state, search: e };
        case "memory":
          return { ...state, memory: e };
        case "report":
          return {
            ...state,
            report: e.report,
            dualTrack: e.dualTrack,
            fromCache: e.fromCache,
            elapsedMs: e.elapsedMs,
          };
        case "done":
          // report 已到则进 done;否则可能是取消/无报告,保持现状由 finally 收尾。
          return state.report ? { ...state, status: "done", progress: 100 } : state;
        case "error":
          return { ...state, status: "error", error: e.message };
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

export interface UseAnalyzeResult extends AnalyzeState {
  start: (req: AnalyzeRequest) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useAnalyze(): UseAnalyzeResult {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    dispatch({ kind: "reset" });
  }, [cancel]);

  const start = useCallback(async (req: AnalyzeRequest) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    dispatch({ kind: "start" });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `请求失败(HTTP ${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* 非 JSON 错误体,沿用默认 */
        }
        dispatch({ kind: "fail", message: msg });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE 以空行(\n\n)分隔事件;保留半包在 buffer。
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line || line.startsWith(":")) continue; // 心跳/注释行忽略
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          try {
            dispatch({ kind: "event", event: JSON.parse(json) as AnalyzeStreamEvent });
          } catch {
            /* 单条解析失败不影响整体流 */
          }
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) return; // 用户主动取消,不报错
      dispatch({ kind: "fail", message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, []);

  return { ...state, start, cancel, reset };
}
