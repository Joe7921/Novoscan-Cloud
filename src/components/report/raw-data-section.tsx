"use client";

import { ExternalLink, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { DualTrackResult } from "@/lib/types";
import { CollapsibleSection } from "./collapsible-section";

// 原始数据:双轨检索的论文/资讯/开源列表 + 可信度依据。
// 缓存命中时 dualTrack=null → 兜底提示(不白屏、诚实说明)。
export function RawDataSection({ dualTrack }: { dualTrack: DualTrackResult | null }) {
  const { t } = useTranslation();
  const r = t.report.rawData;

  return (
    <CollapsibleSection title={t.report.sections.rawData}>
      {!dualTrack ? (
        <p className="text-sm text-muted-foreground">{r.noSnapshot}</p>
      ) : (
        <div className="space-y-5">
          {dualTrack.finalCredibility.reasoning.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {r.credibilityReasoning}
              </h4>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                {dualTrack.finalCredibility.reasoning.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {dualTrack.academic.results.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {r.papers} · {dualTrack.academic.results.length}
              </h4>
              <ul className="space-y-1">
                {dualTrack.academic.results.slice(0, 20).map((p, i) => (
                  <li key={i} className="text-sm">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 hover:underline"
                      >
                        <span className="line-clamp-1">{p.title ?? p.url}</span>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <span className="line-clamp-1">{p.title}</span>
                    )}
                    {p.year ? <span className="ml-1 text-xs text-muted-foreground">({p.year})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dualTrack.industry.webResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {r.web} · {dualTrack.industry.webResults.length}
              </h4>
              <ul className="space-y-1">
                {dualTrack.industry.webResults.slice(0, 15).map((web, i) => (
                  <li key={i} className="text-sm">
                    {web.url ? (
                      <a
                        href={web.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 hover:underline"
                      >
                        <span className="line-clamp-1">{web.title ?? web.url}</span>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <span className="line-clamp-1">{web.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dualTrack.industry.githubRepos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {r.github} · {dualTrack.industry.githubRepos.length}
              </h4>
              <ul className="space-y-1">
                {dualTrack.industry.githubRepos.slice(0, 15).map((repo, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {repo.url ? (
                      <a
                        href={repo.url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span className="line-clamp-1">{repo.fullName ?? repo.name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <span className="line-clamp-1">{repo.fullName ?? repo.name}</span>
                    )}
                    {typeof repo.stars === "number" && (
                      <Badge variant="muted" className="shrink-0">
                        <Star className="h-3 w-3" />
                        {repo.stars} {r.stars}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
