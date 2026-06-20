// analyze 接口的请求与流式事件契约(引擎/界面分离,铁律②)。
// 路由把 AnalyzeStreamEvent 包成 SSE;前端(阶段 7)据 type 驱动三态。

import type {
  DualTrackResult,
  FinalReport,
  Language,
  ModelProvider,
  ScanMode,
} from "@/lib/types";

/** 分析请求入参(POST /api/analyze 请求体)。 */
export interface AnalyzeRequest {
  /** 用户原始创意/长文(必填,最少 4 字) */
  query: string;
  /** 报告语言,默认 zh */
  language?: Language;
  /** 分析深度,默认 standard */
  mode?: ScanMode;
  /** 主模型提供商,默认 deepseek */
  modelProvider?: ModelProvider;
  /** 为 true 时跳过缓存、强制重生成 */
  refresh?: boolean;
  /** 用户指定的学科领域提示(可选) */
  domainHint?: string;
}

/** 接口流程阶段(phase 事件用,前端可显示粗粒度进度)。 */
export type AnalyzePhase = "cache" | "memory" | "search" | "pipeline" | "persist";

/**
 * SSE 流事件(每条 `data: {json}\n\n`,按 type 判别)。
 * - 引擎透传:progress / log / agent_state / agent_thinking
 * - 路由级:phase / memory / search / report / error / done
 */
export type AnalyzeStreamEvent =
  | { type: "phase"; phase: AnalyzePhase; message: string }
  | { type: "progress"; value: number }
  | { type: "log"; message: string }
  | { type: "agent_state"; agentId: string; status: string }
  | { type: "agent_thinking"; agentId?: string; text: string }
  | { type: "memory"; experiencesUsed: number; relevantQueries: string[] }
  | {
      type: "search";
      credibility: number;
      level: string;
      academic: number;
      web: number;
      github: number;
    }
  | {
      type: "report";
      report: FinalReport;
      dualTrack: DualTrackResult | null;
      fromCache: boolean;
      elapsedMs: number;
    }
  | { type: "error"; message: string }
  | { type: "done" };

/** 流事件发射器(路由把它接到 SSE,脚本把它接到 console)。 */
export type EmitEvent = (event: AnalyzeStreamEvent) => void;
