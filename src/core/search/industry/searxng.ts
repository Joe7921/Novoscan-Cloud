// SearXNG 自部署元搜索(需 SEARXNG_BASE_URL;未配置则跳过)。降级链终极兜底。
import type { WebResult } from "@/lib/types";

interface SearxItem {
  title?: string;
  url?: string;
  content?: string;
}

export async function searchSearXNG(query: string, opts: { maxResults?: number } = {}): Promise<WebResult[]> {
  const base = process.env.SEARXNG_BASE_URL;
  if (!base) return [];
  const token = process.env.SEARXNG_API_TOKEN;
  const params = new URLSearchParams({ q: query, format: "json" });
  if (token) params.set("token", token);
  const maxResults = Math.min(Math.max(opts.maxResults ?? 15, 1), 20);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/search?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000), // 自部署可能较慢
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: SearxItem[] };
    return (data.results ?? []).slice(0, maxResults).map((r): WebResult => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      description: r.content,
      source: "searxng",
    }));
  } catch {
    return [];
  }
}
