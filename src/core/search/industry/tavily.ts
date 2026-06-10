// Tavily AI Search(需 TAVILY_API_KEY;未配置则跳过)。降级链第二层。
import type { WebResult } from "@/lib/types";

const ENDPOINT = "https://api.tavily.com/search";

interface TavilyItem {
  title?: string;
  url?: string;
  content?: string;
}

export async function searchTavily(query: string, opts: { maxResults?: number } = {}): Promise<WebResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const maxResults = Math.min(Math.max(opts.maxResults ?? 15, 1), 20);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_answer: false }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: TavilyItem[] };
    return (data.results ?? []).map((r): WebResult => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      description: r.content,
      source: "tavily",
    }));
  } catch {
    return [];
  }
}
