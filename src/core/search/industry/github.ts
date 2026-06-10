// GitHub 开源项目检索。GITHUB_TOKEN 可选(匿名 60 次/小时,带 token 5000 次/小时)。
// 参考旧库 server/industry/github.ts:中文词 GitHub 极少命中,优先英文词。
import type { GithubRepo } from "@/lib/types";

const ENDPOINT = "https://api.github.com/search/repositories";

interface GHRepo {
  name?: string;
  full_name?: string;
  description?: string;
  html_url?: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
  topics?: string[];
  archived?: boolean;
  pushed_at?: string;
}

function health(repo: GHRepo): string {
  if (repo.archived) return "declining";
  if (!repo.pushed_at) return "stable";
  const days = (Date.now() - new Date(repo.pushed_at).getTime()) / 86_400_000;
  return days < 90 ? "active" : days < 365 ? "stable" : "declining";
}

export async function searchGithub(query: string, opts: { perPage?: number } = {}): Promise<GithubRepo[]> {
  const perPage = Math.min(Math.max(opts.perPage ?? 10, 1), 30);
  // 优先英文词(GitHub 对中文匹配极差);无英文词则原样。
  const enTerms = query.match(/[a-zA-Z][a-zA-Z0-9.+-]{1,}/g);
  const q = enTerms && enTerms.length ? enTerms.slice(0, 3).join(" ") : query;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Novoscan/1.0",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const params = new URLSearchParams({ q, sort: "stars", order: "desc", per_page: String(perPage) });
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: GHRepo[] };
    return (data.items ?? []).map((r): GithubRepo => ({
      name: r.name,
      fullName: r.full_name,
      stars: r.stargazers_count,
      health: health(r),
      language: r.language,
      topics: r.topics ?? [],
      description: r.description ?? undefined,
      url: r.html_url,
    }));
  } catch {
    return [];
  }
}
