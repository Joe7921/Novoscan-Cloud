// CORE 学术检索(需 CORE_API_KEY;未配置则优雅跳过返回空)。
// 参考旧库 server/academic/core.ts 重写,映射为统一 AcademicPaper。

import type { AcademicPaper } from "@/lib/types";

const ENDPOINT = "https://api.core.ac.uk/v3/search/works";

interface CoreWork {
  id?: string | number;
  title?: string;
  authors?: Array<{ name?: string } | string>;
  yearPublished?: number;
  citationCount?: number;
  downloadUrl?: string;
  links?: Array<{ type?: string; url?: string }>;
  abstract?: string;
  subjects?: string[];
  doi?: string;
}

export async function searchCore(
  query: string,
  opts: { fromYear?: number; limit?: number } = {},
): Promise<AcademicPaper[]> {
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey) return []; // 未配置 Key:优雅跳过

  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  let q = query;
  if (opts.fromYear) q += ` AND yearPublished>=${opts.fromYear}`;
  const params = new URLSearchParams({ q, limit: String(limit), scroll: "false" });

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: CoreWork[] };
    return (data.results ?? []).map((w): AcademicPaper => {
      const downloadUrl =
        w.downloadUrl ?? w.links?.find((l) => l.type === "download")?.url;
      return {
        title: w.title,
        year: w.yearPublished,
        authors: (w.authors ?? [])
          .map((a) => (typeof a === "string" ? a : a.name))
          .filter((n): n is string => !!n),
        citationCount: w.citationCount,
        url: downloadUrl ?? (w.doi ? `https://doi.org/${w.doi}` : undefined),
        pdfUrl: downloadUrl,
        description: w.abstract,
        concepts: w.subjects ?? [],
        isOpenAccess: !!downloadUrl,
        source: "core",
      };
    });
  } catch {
    return [];
  }
}
