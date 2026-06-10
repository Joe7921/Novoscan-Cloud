// SerpAPI(需 SERPAPI_KEY;未配置则跳过)。一级网页源,支持多引擎。
import type { WebResult } from "@/lib/types";

const ENDPOINT = "https://serpapi.com/search";

interface SerpOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

export type SerpEngine = "google" | "bing" | "baidu" | "duckduckgo";

export async function searchSerpAPI(
  query: string,
  opts: { engine?: SerpEngine; num?: number } = {},
): Promise<WebResult[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  const engine = opts.engine ?? "google";
  const num = Math.min(Math.max(opts.num ?? 10, 1), 20);
  const params = new URLSearchParams({ q: query, engine, num: String(num), api_key: key });
  if (engine === "google") {
    params.set("hl", "zh-cn");
    params.set("gl", "cn");
  }
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { organic_results?: SerpOrganic[] };
    return (data.organic_results ?? []).map((r): WebResult => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      description: r.snippet,
      source: "serpapi",
    }));
  } catch {
    return [];
  }
}
