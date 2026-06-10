// Brave Search(需 BRAVE_API_KEY;未配置则跳过)。一级网页源。
import type { WebResult } from "@/lib/types";

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

interface BraveItem {
  title?: string;
  url?: string;
  description?: string;
}

export async function searchBrave(query: string, opts: { count?: number } = {}): Promise<WebResult[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return [];
  const count = Math.min(Math.max(opts.count ?? 10, 1), 20);
  const params = new URLSearchParams({ q: query, count: String(count) });
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { web?: { results?: BraveItem[] } };
    return (data.web?.results ?? []).map((r): WebResult => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      description: r.description,
      source: "brave",
    }));
  } catch {
    return [];
  }
}
