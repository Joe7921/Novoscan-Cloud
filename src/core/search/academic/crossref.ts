// CrossRef 学术检索(免费,无需 Key;配 CROSSREF_EMAIL 进 polite pool 提速)。
// 参考旧库 server/academic/crossref.ts 重写,映射为统一 AcademicPaper。

import type { AcademicPaper } from "@/lib/types";

const ENDPOINT = "https://api.crossref.org/works";

interface CRItem {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  "is-referenced-by-count"?: number;
  "container-title"?: string[];
  publisher?: string;
  URL?: string;
  abstract?: string;
  subject?: string[];
  license?: Array<{ URL?: string }>;
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  created?: { "date-parts"?: number[][] };
}

function extractYear(item: CRItem): number | undefined {
  const src =
    item["published-print"] ?? item["published-online"] ?? item.published ?? item.created;
  return src?.["date-parts"]?.[0]?.[0];
}

function stripHtml(text?: string): string | undefined {
  if (!text) return undefined;
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined;
}

export async function searchCrossRef(
  query: string,
  opts: { fromYear?: number; rows?: number } = {},
): Promise<AcademicPaper[]> {
  const rows = Math.min(Math.max(opts.rows ?? 10, 1), 50);
  const email = process.env.CROSSREF_EMAIL;

  const params = new URLSearchParams({ query, rows: String(rows), sort: "relevance" });
  if (email) params.set("mailto", email);
  if (opts.fromYear) params.set("filter", `from-pub-date:${opts.fromYear}`);

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: email ? { "User-Agent": `Novoscan/1.0 (mailto:${email})` } : {},
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { message?: { items?: CRItem[] } };
    return (data.message?.items ?? []).map((item): AcademicPaper => ({
      title: item.title?.[0],
      year: extractYear(item),
      authors: (item.author ?? [])
        .map((a) => [a.given, a.family].filter(Boolean).join(" "))
        .filter(Boolean),
      citationCount: item["is-referenced-by-count"],
      url: item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : undefined),
      description: stripHtml(item.abstract),
      venue: item["container-title"]?.[0] ?? item.publisher,
      concepts: item.subject ?? [],
      isOpenAccess: (item.license ?? []).some((l) => /creativecommons/i.test(l.URL ?? "")),
      source: "crossref",
    }));
  } catch {
    return [];
  }
}
