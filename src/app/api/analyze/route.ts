// POST /api/analyze —— 交互式分析接口(SSE 流式)。
// 把 runAnalysis 的流事件包成 Server-Sent Events;客户端断开即取消引擎。
// 引擎/界面分离(铁律②):本文件只负责 HTTP↔SSE 转换,编排在 lib/analyze。

import { runAnalysis } from "@/lib/analyze/run-analysis";
import type { AnalyzeRequest, AnalyzeStreamEvent } from "@/lib/analyze/types";
import type { ModelProvider } from "@/lib/types";

export const runtime = "nodejs"; // 引擎依赖 Node API + 长任务,不用 Edge
export const maxDuration = 800; // 长分析(数分钟);平台上限以部署配置为准
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const sse = (e: AnalyzeStreamEvent): Uint8Array => encoder.encode(`data: ${JSON.stringify(e)}\n\n`);
const HEARTBEAT = encoder.encode(": ping\n\n"); // SSE 注释行心跳,保活长任务连接
const HEARTBEAT_MS = 15_000;

const VALID_PROVIDERS: ModelProvider[] = ["deepseek", "minimax", "moonshot"];
function safeProvider(value: unknown): ModelProvider {
  return VALID_PROVIDERS.includes(value as ModelProvider) ? (value as ModelProvider) : "deepseek";
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(req: Request): Promise<Response> {
  let body: Partial<AnalyzeRequest>;
  try {
    body = (await req.json()) as Partial<AnalyzeRequest>;
  } catch {
    return badRequest("请求体不是合法 JSON");
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 4) {
    return badRequest("query 不能为空,且至少 4 个字符");
  }

  const request: AnalyzeRequest = {
    query,
    language: body.language === "en" ? "en" : "zh",
    mode: body.mode === "flash" ? "flash" : "standard",
    modelProvider: safeProvider(body.modelProvider),
    refresh: body.refresh === true,
    domainHint: typeof body.domainHint === "string" ? body.domainHint : undefined,
  };

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AnalyzeStreamEvent): void => {
        if (closed) return;
        try {
          controller.enqueue(sse(e));
        } catch {
          closed = true; // 控制器已关闭(客户端断开)
        }
      };
      // 心跳:单个 AI 调用实测可静默 90-110s,定期发注释行防反代/浏览器空闲断连。
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(HEARTBEAT);
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);
      try {
        await runAnalysis(request, emit, req.signal);
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
        emit({ type: "done" });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* 已关闭,忽略 */
          }
        }
      }
    },
    cancel() {
      closed = true; // 客户端断开:停止写入(req.signal 已转发给引擎取消)
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 关闭反代缓冲,保证实时推送
    },
  });
}
