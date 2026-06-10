// OpenAlex 学术检索(免费,无需 API Key;配 OPENALEX_EMAIL 进 polite pool 提速)。
// 参考旧库 server/academic/openalex.ts 重写,映射为统一 AcademicPaper。

import type { AcademicPaper } from "@/lib/types";

const ENDPOINT = "https://api.openalex.org/works";

interface OAWork {
  id?: string;
  doi?: string;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  open_access?: { is_oa?: boolean; oa_url?: string };
  abstract_inverted_index?: Record<string, number[]>;
  topics?: Array<{ display_name?: string }>;
  primary_location?: { source?: { display_name?: string } };
}

// 倒排索引还原摘要。
function reconstructAbstract(inv?: Record<string, number[]>): string | undefined {
  if (!inv) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const p of positions) words[p] = word;
  }
  const text = words.filter(Boolean).join(" ").trim();
  return text || undefined;
}

export async function searchOpenAlex(
  query: string,
  opts: { fromYear?: number; perPage?: number } = {},
): Promise<AcademicPaper[]> {
  const fromYear = opts.fromYear ?? 2020;
  const perPage = Math.min(Math.max(opts.perPage ?? 10, 1), 25);
  const email = process.env.OPENALEX_EMAIL;

  const params = new URLSearchParams({
    search: query,
    filter: `publication_year:>${fromYear - 1}`,
    "per-page": String(perPage),
    sort: "relevance_score:desc",
    select:
      "id,doi,display_name,authorships,publication_year,cited_by_count,open_access,abstract_inverted_index,topics,primary_location",
  });
  if (email) params.set("mailto", email);

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: email ? { "User-Agent": `Novoscan/1.0 (mailto:${email})` } : {},
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: OAWork[] };
    return (data.results ?? []).map((w): AcademicPaper => ({
      title: w.display_name,
      year: w.publication_year,
      citationCount: w.cited_by_count,
      authors: (w.authorships ?? [])
        .slice(0, 5)
        .map((a) => a.author?.display_name)
        .filter((n): n is string => !!n),
      url: w.open_access?.oa_url ?? w.doi ?? w.id,
      isOpenAccess: w.open_access?.is_oa,
      concepts: (w.topics ?? [])
        .slice(0, 5)
        .map((t) => t.display_name)
        .filter((n): n is string => !!n),
      venue: w.primary_location?.source?.display_name,
      description: reconstructAbstract(w.abstract_inverted_index),
      source: "openalex",
    }));
  } catch {
    return [];
  }
}
