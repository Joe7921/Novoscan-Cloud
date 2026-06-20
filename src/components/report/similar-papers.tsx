"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { SimilarPaper } from "@/lib/types";

// 高相似度论文(相似度 + 核心差异 + 可点 URL 溯源)。
export function SimilarPapers({ papers }: { papers: SimilarPaper[] }) {
  const { t } = useTranslation();
  if (!papers.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t.report.similarPapers.title}
      </h4>
      <ul className="space-y-2">
        {papers.map((p, i) => (
          <li key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    >
                      <span className="line-clamp-2">{p.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium">{p.title}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.authors ? `${p.authors} · ` : ""}
                  {p.year}
                  {p.venue ? ` · ${p.venue}` : ""}
                  {typeof p.citationCount === "number" ? ` · ${p.citationCount} cites` : ""}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {t.report.similarPapers.similarity} {Math.round(p.similarityScore)}
              </Badge>
            </div>
            {p.keyDifference && (
              <p className="mt-2 text-sm leading-relaxed">
                <span className="text-muted-foreground">{t.report.similarPapers.keyDifference}:</span>{" "}
                {p.keyDifference}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
