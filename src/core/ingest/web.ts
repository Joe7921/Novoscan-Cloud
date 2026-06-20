// 网页解析:Jina Reader(r.jina.ai)贴链接返回正文 markdown,免自写爬虫与正文提取。
// 免费档无需 key(有限流);配置 JINA_API_KEY 可提额度。

import { IngestError } from "./types";

const JINA_READER = "https://r.jina.ai/";

/** 经 Jina Reader 抓取网页正文。返回 { title, text }。 */
export async function parseWeb(
  url: string,
  signal?: AbortSignal,
): Promise<{ title: string; text: string }> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new IngestError(`不是合法的链接:${url}`, "bad_input");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new IngestError("只支持 http/https 链接", "bad_input");
  }

  const headers: Record<string, string> = {
    // 让 Jina 返回纯正文(markdown),并附带 Title/URL Source 头部。
    "X-Return-Format": "markdown",
    Accept: "text/plain",
  };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;

  let res: Response;
  try {
    res = await fetch(JINA_READER + target.toString(), { headers, signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new IngestError(
      `网页抓取失败:${err instanceof Error ? err.message : String(err)}`,
      "upstream",
    );
  }
  if (!res.ok) {
    throw new IngestError(`网页抓取失败(Jina ${res.status}),可能该页禁止抓取或链接失效`, "upstream");
  }

  const body = await res.text();
  return splitTitle(body, target.toString());
}

// Jina 正文前会带 `Title: ...` / `URL Source: ...` / `Markdown Content:` 头部,拆出标题与正文。
function splitTitle(body: string, fallbackUrl: string): { title: string; text: string } {
  const titleMatch = body.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() || fallbackUrl;
  const marker = body.indexOf("Markdown Content:");
  const text = marker >= 0 ? body.slice(marker + "Markdown Content:".length).trim() : body.trim();
  return { title, text };
}
