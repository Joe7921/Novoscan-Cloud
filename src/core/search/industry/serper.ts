// Serper.dev(需 SERPER_API_KEY;未配置则跳过)。降级链第一层。
import type { WebResult } from "@/lib/types";

const ENDPOINT = "https://google.serper.dev/search";

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

export async function searchSerper(query: string, opts: { num?: number } = {}): Promise<WebResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  const num = Math.min(Math.max(opts.num ?? 15, 1), 20);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num, gl: "cn", hl: "zh-cn" }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { organic?: SerperOrganic[] };
    return (data.organic ?? []).map((r): WebResult => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      description: r.snippet,
      source: "serper",
    }));
  } catch {
    return [];
  }
}
