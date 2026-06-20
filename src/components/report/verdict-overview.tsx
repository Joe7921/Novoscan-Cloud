"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { DualTrackResult, FinalReport } from "@/lib/types";
import { InnovationRadar } from "./radar-chart";

// 结论概览卡:总分(大字)+ 推荐结论 + 可信度 + 共识 + 六维雷达。
export function VerdictOverview({
  report,
  dualTrack,
}: {
  report: FinalReport;
  dualTrack: DualTrackResult | null;
}) {
  const { t, locale } = useTranslation();
  const o = t.report.overview;
  const arb = report.arbitration;
  const radar = report.innovationEvaluation.innovationRadar ?? [];
  const credibility = dualTrack?.finalCredibility ?? null;

  return (
    <Card>
      <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_280px]">
        {/* 左:结论文字 */}
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <span className="font-mono text-5xl font-bold tabular-nums leading-none">
              {Math.round(arb.overallScore)}
            </span>
            <span className="mb-1 text-sm text-muted-foreground">/ 100 · {o.overallScore}</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {o.recommendation}
            </div>
            <div className="text-lg font-semibold">{arb.recommendation || "—"}</div>
          </div>
          {arb.summary && <p className="text-sm leading-relaxed text-muted-foreground">{arb.summary}</p>}

          <Separator />
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {credibility && (
              <div>
                <span className="text-muted-foreground">{o.credibility}:</span>{" "}
                <span className="font-mono font-semibold tabular-nums">{Math.round(credibility.score)}</span>{" "}
                <span className="text-muted-foreground">({t.report.confidence[credibility.level]})</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{o.consensus}:</span>{" "}
              <span className="font-medium">{t.report.consensusLevels[arb.consensusLevel]}</span>
            </div>
          </div>
        </div>

        {/* 右:六维雷达 */}
        {radar.length > 0 && (
          <div className="space-y-1">
            <div className="text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t.report.radar.title}
            </div>
            <InnovationRadar dimensions={radar} locale={locale} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
