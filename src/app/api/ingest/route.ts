// POST /api/ingest —— 富输入解析接口。
// 把上传文件(PDF/Word/图片)或网页链接解析成纯富文字,前端据此挂"附件"。
// 引擎/界面分离:本文件只做 HTTP↔ingest 转换,解析逻辑在 core/ingest。
//
// 两种请求:
//   ① multipart/form-data,字段 file=<文件>           → PDF / .docx / 图片
//   ② application/json,{ "url": "https://..." }       → 网页链接
// 成功返回 IngestResult;失败返回 { error } + 4xx/5xx。

import { ingestFile, ingestUrl, IngestError, INGEST_LIMITS } from "@/core/ingest";

export const runtime = "nodejs"; // unpdf/mammoth 依赖 Node;图片理解走 vision(可达数十秒)
export const maxDuration = 180;
export const dynamic = "force-dynamic";

function fail(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function statusOf(err: IngestError): number {
  if (err.category === "bad_input") return 400;
  if (err.category === "upstream") return 502;
  return 500;
}

export async function POST(req: Request): Promise<Response> {
  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ---- ② 网页链接(JSON) ----
    if (contentType.includes("application/json")) {
      let body: { url?: unknown };
      try {
        body = (await req.json()) as { url?: unknown };
      } catch {
        return fail("请求体不是合法 JSON", 400);
      }
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!url) return fail("缺少链接 url", 400);
      const result = await ingestUrl(url, req.signal);
      return Response.json(result);
    }

    // ---- ① 上传文件(multipart) ----
    if (contentType.includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return fail("表单解析失败", 400);
      }
      const file = form.get("file");
      if (!(file instanceof File)) return fail("缺少文件字段 file", 400);
      // 大小先在此粗筛(core/ingest 内还会按类型精筛),避免无谓读入超大 body。
      if (file.size > INGEST_LIMITS.maxDocBytes) {
        return fail(`文件过大,上限 ${(INGEST_LIMITS.maxDocBytes / 1024 / 1024).toFixed(0)}MB`, 400);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await ingestFile(
        { bytes, filename: file.name, mimeType: file.type || undefined },
        req.signal,
      );
      return Response.json(result);
    }

    return fail("不支持的 Content-Type(用 multipart 传文件,或 JSON 传链接)", 415);
  } catch (err) {
    if (err instanceof IngestError) return fail(err.message, statusOf(err));
    if ((err as Error)?.name === "AbortError") return fail("请求已取消", 499);
    return fail(`解析失败:${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
