// arXiv 学术检索(免费,无需 Key)。返回 Atom XML,用正则解析。
// 参考旧库 server/academic/arxiv.ts 重写,映射为统一 AcademicPaper。

import type { AcademicPaper } from "@/lib/types";

const ENDPOINT = "http://export.arxiv.org/api/query";

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].replace(/\s+/g, " ").trim() : undefined;
}

export async function searchArxiv(
  query: string,
  opts: { maxResults?: number } = {},
): Promise<AcademicPaper[]> {
  const maxResults = Math.min(Math.max(opts.maxResults ?? 10, 1), 50);
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(maxResults),
    sortBy: "relevance",
    sortOrder: "descending",
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`);
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1);
    return entries.map((block): AcademicPaper => {
      const id = (tag(block, "id") ?? "").split("/").pop() ?? "";
      const authors = [...block.matchAll(/<name>([\s\S]*?)<\/name>/g)]
        .map((m) => m[1].trim())
        .filter(Boolean);
      const published = tag(block, "published") ?? "";
      const year = published ? Number(published.slice(0, 4)) : undefined;
      const categories = [...block.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1]);
      return {
        title: tag(block, "title"),
        year,
        authors,
        url: id ? `https://arxiv.org/abs/${id}` : undefined,
        pdfUrl: id ? `https://arxiv.org/pdf/${id}.pdf` : undefined,
        description: tag(block, "summary"),
        concepts: categories,
        isOpenAccess: true, // arXiv 全开放
        source: "arxiv",
      };
    });
  } catch {
    return [];
  }
}
