// 分析编排核心(纯逻辑 + 回调,不依赖 HTTP)。
// 缓存 → 记忆召回 → 双轨检索 → 多 Agent 管线 → 吐报告 → 沉淀缓存/记忆。
// 路由 app/api/analyze 把 emit 接到 SSE;脚本可直接调用本函数测试。
//
// 注册副作用:导入下列模块即注册真子 Agent 工具与 novoscan-default 管线。
import "@/core/agents";
import "@/core/pipeline";

import { searchDualTrack } from "@/core/search";
import { runPipeline } from "@/core/orchestrator";
import { getCachedReport, saveCachedReport } from "@/lib/data/search-history";
import { saveExperience, searchMemories } from "@/lib/data/agent-memory";
import type {
  AgentMemoryInsert,
  AgentMemoryRow,
  AgentOutput,
  DualTrackResult,
  FinalReport,
  MemoryInsight,
  ModelProvider,
  OnProgress,
} from "@/lib/types";
import type { AnalyzeRequest, AnalyzeStreamEvent, EmitEvent } from "./types";

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// 记忆召回喂 tsvector 的查询上限:长文(数千字)整段进 plainto_tsquery 既慢又可能超长报错,
// 截到前 N 字做召回足够(关键概念多在开头);完整 query 仍用于检索/分析/沉淀。
const MEMORY_QUERY_MAXLEN = 400;

/** 引擎原生 onProgress(event,data) → 流事件。未知事件忽略。 */
function forwardEngineEvent(emit: EmitEvent): OnProgress {
  return (event, data) => {
    switch (event) {
      case "progress":
        emit({ type: "progress", value: typeof data === "number" ? data : Number(data) || 0 });
        break;
      case "log": {
        let message: string;
        if (typeof data === "object") {
          try {
            message = JSON.stringify(data);
          } catch {
            message = "[无法序列化的日志对象]"; // 防循环引用导致回调抛出
          }
        } else {
          message = String(data);
        }
        emit({ type: "log", message });
        break;
      }
      case "agent_state": {
        const d = (data ?? {}) as Record<string, unknown>;
        emit({ type: "agent_state", agentId: String(d.agentId ?? ""), status: String(d.status ?? "") });
        break;
      }
      case "agent_thinking":
      case "agent_stream": {
        const d = (data ?? {}) as Record<string, unknown>;
        const text = typeof data === "string" ? data : String(d.text ?? d.delta ?? "");
        if (text) emit({ type: "agent_thinking", agentId: d.agentId ? String(d.agentId) : undefined, text });
        break;
      }
      default:
        break; // agent_memory 等暂不透传
    }
  };
}

/** 召回的历史经验 → 注入 Agent prompt 的 memoryContext 文本。 */
function formatMemoryContext(mems: AgentMemoryRow[]): string {
  return mems
    .map((m, i) => {
      const lessons = m.lessons_learned?.slice(0, 3).join("、") || "无";
      return `${i + 1}. 相关创意「${m.query}」→ 评分 ${m.final_score}「${m.recommendation}」;经验教训:${lessons}`;
    })
    .join("\n");
}

/** FinalReport → 记忆表插入行(query_hash 由 saveExperience 自动算)。 */
function reportToMemory(
  query: string,
  report: FinalReport,
  dual: DualTrackResult,
  modelProvider: ModelProvider,
  elapsedMs: number,
): Omit<AgentMemoryInsert, "query_hash"> {
  // 各数组字段类型上必填,但报告由 AI + 降级路径生成,运行时仍可能缺失;统一 ?? [] 兜底,
  // 避免 .slice 抛错导致沉淀静默失败。
  const pick = (a: AgentOutput) => ({
    score: a.score,
    confidence: a.confidence,
    keyFindings: (a.keyFindings ?? []).slice(0, 3),
  });
  return {
    query,
    agent_judgments: {
      academic: pick(report.academicReview),
      industry: pick(report.industryAnalysis),
      competitor: pick(report.competitorAnalysis),
      innovation: pick(report.innovationEvaluation),
    },
    final_score: report.arbitration.overallScore,
    recommendation: report.arbitration.recommendation,
    lessons_learned: (report.arbitration.nextSteps ?? []).slice(0, 8),
    quality_flags: [...(report.qualityCheck.issues ?? []), ...(report.qualityCheck.warnings ?? [])].slice(0, 10),
    debate_summary: report.debate.dissentReportText || report.debate.triggerReason,
    tags: (dual.academic.topConcepts ?? []).slice(0, 10),
    model_provider: modelProvider,
    execution_time_ms: elapsedMs,
    // 经验有用性暂用质检一致性分归一化;接入反馈后可迭代。
    usefulness_score: Math.max(0, Math.min(1, report.qualityCheck.consistencyScore / 100)),
  };
}

/**
 * 执行一次完整分析,全程通过 emit 吐进度。失败由调用方(路由)捕获转 error 事件。
 * @param signal 客户端断开信号:转发给引擎取消 AI 调用;断开后跳过沉淀。
 *
 * TODO(阶段后期):长任务(~数分钟)生产环境应派发 Inngest 后台函数,
 * 前端经 channel 收进度;本函数的 (req, emit, signal) 切面即为接入点。
 */
export async function runAnalysis(
  req: AnalyzeRequest,
  emit: EmitEvent,
  signal?: AbortSignal,
): Promise<void> {
  const query = req.query;
  const language = req.language ?? "zh";
  const mode = req.mode ?? "standard";
  const modelProvider = req.modelProvider ?? "deepseek";
  const t0 = Date.now();
  const onProgress = forwardEngineEvent(emit);

  // 1. 查缓存
  if (!req.refresh) {
    emit({ type: "phase", phase: "cache", message: "查询缓存" });
    let cached: FinalReport | null = null;
    try {
      cached = await getCachedReport(query, language, mode);
    } catch (e) {
      emit({ type: "log", message: `缓存查询失败(忽略): ${errMsg(e)}` });
    }
    if (cached) {
      emit({ type: "report", report: cached, dualTrack: null, fromCache: true, elapsedMs: Date.now() - t0 });
      emit({ type: "done" });
      return;
    }
  }

  // 2. 记忆召回(tsvector;务实版,pgvector 语义召回留 TODO)
  emit({ type: "phase", phase: "memory", message: "召回历史经验" });
  let memoryContext: string | undefined;
  let memoryInsight: MemoryInsight | undefined;
  try {
    const mems = await searchMemories(query.slice(0, MEMORY_QUERY_MAXLEN), 5);
    if (mems.length) {
      memoryContext = formatMemoryContext(mems);
      memoryInsight = {
        experiencesUsed: mems.length,
        relevantQueries: mems.map((m) => m.query),
        contextSummary: `召回 ${mems.length} 条相关历史经验`,
      };
      emit({ type: "memory", experiencesUsed: mems.length, relevantQueries: memoryInsight.relevantQueries });
    }
  } catch (e) {
    emit({ type: "log", message: `记忆召回失败(忽略): ${errMsg(e)}` });
  }

  // 3. 双轨检索
  emit({ type: "phase", phase: "search", message: "双轨检索(学术 + 产业)" });
  const dual = await searchDualTrack(query, { onProgress });
  emit({
    type: "search",
    credibility: dual.finalCredibility.score,
    level: dual.finalCredibility.level,
    academic: dual.academic.results.length,
    web: dual.industry.webResults.length,
    github: dual.industry.githubRepos.length,
  });

  // 客户端在检索阶段已断开:不再启动昂贵的管线(注:searchDualTrack 暂不支持中断,
  // 当前检索会跑完;为搜索层加 abortSignal 透传是后续优化,见 PLAN F.5)。
  if (signal?.aborted) {
    emit({ type: "done" });
    return;
  }

  // 4. 跑管线(带记忆上下文 + 取消信号)
  emit({ type: "phase", phase: "pipeline", message: "多 Agent 分层分析" });
  const report = await runPipeline({
    pipeline: "novoscan-default",
    input: {
      query,
      academicData: dual.academic,
      industryData: dual.industry,
      language,
      modelProvider,
      domainHint: req.domainHint,
      memoryContext,
      abortSignal: signal,
      onProgress,
    },
  });
  if (memoryInsight) report.memoryInsight = memoryInsight;
  const elapsedMs = Date.now() - t0;

  // 5. 先吐报告(附原始数据,供前端渲染),沉淀放后面不拖慢 UX
  emit({ type: "report", report, dualTrack: dual, fromCache: false, elapsedMs });

  // 6. 沉淀缓存 + 记忆(best-effort;客户端已断开则跳过,不存部分结果)
  if (!signal?.aborted) {
    emit({ type: "phase", phase: "persist", message: "沉淀缓存与记忆" });
    try {
      await saveCachedReport({ query, language, mode, result: report, modelProvider });
    } catch (e) {
      emit({ type: "log", message: `写缓存失败(忽略): ${errMsg(e)}` });
    }
    try {
      await saveExperience(reportToMemory(query, report, dual, modelProvider, elapsedMs));
    } catch (e) {
      emit({ type: "log", message: `沉淀记忆失败(忽略): ${errMsg(e)}` });
    }
  }

  emit({ type: "done" });
}
