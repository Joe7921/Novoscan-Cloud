"use client";

import { AlertTriangle, Database, RotateCw, SquarePen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { DualTrackResult, FinalReport } from "@/lib/types";
import { AgentSection } from "./agent-section";
import { ArbitrationSection } from "./arbitration-section";
import { CollapsibleSection } from "./collapsible-section";
import { DebateSection } from "./debate-section";
import { RawDataSection } from "./raw-data-section";
import { SimilarPapers } from "./similar-papers";
import { VerdictOverview } from "./verdict-overview";

function isPartial(report: FinalReport): boolean {
  const agents = [
    report.academicReview,
    report.industryAnalysis,
    report.competitorAnalysis,
    report.innovationEvaluation,
  ];
  return (
    agents.some((a) => a.isFallback) ||
    report.arbitration.isPartial === true ||
    report.qualityCheck.passed === false
  );
}

export function ReportView({
  report,
  dualTrack,
  fromCache,
  elapsedMs,
  onRefresh,
  onReset,
}: {
  report: FinalReport;
  dualTrack: DualTrackResult | null;
  fromCache: boolean;
  elapsedMs: number;
  onRefresh: () => void;
  onReset: () => void;
}) {
  const { t, locale } = useTranslation();
  const s = t.report.sections;
  const cross = report.crossDomainTransfer;
  const partial = isPartial(report);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-6 py-8">
      {/* 头部:缓存徽标 / 耗时 / 刷新 / 新分析 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {fromCache && (
            <Badge variant="muted">
              <Database className="h-3 w-3" />
              {t.report.fromCacheBadge}
            </Badge>
          )}
          {elapsedMs > 0 && (
            <span className="text-xs text-muted-foreground">
              {t.report.elapsed} {(elapsedMs / 1000).toFixed(0)}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RotateCw className="h-3.5 w-3.5" />
            {t.report.refresh}
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <SquarePen className="h-3.5 w-3.5" />
            {t.board.analysis.analyzeAgain}
          </Button>
        </div>
      </div>

      {/* 部分结果/低置信横幅 */}
      {partial && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t.report.partialBanner}</span>
        </div>
      )}

      {/* 结论概览 */}
      <VerdictOverview report={report} dualTrack={dualTrack} />

      {/* 分区折叠 */}
      <div className="space-y-3">
        <AgentSection
          title={s.academic}
          output={report.academicReview}
          defaultOpen
          extra={
            report.academicReview.similarPapers?.length ? (
              <SimilarPapers papers={report.academicReview.similarPapers} />
            ) : undefined
          }
        />
        <AgentSection title={s.industry} output={report.industryAnalysis} />
        <AgentSection title={s.competitor} output={report.competitorAnalysis} />
        <AgentSection
          title={s.innovation}
          output={report.innovationEvaluation}
          extra={
            report.innovationEvaluation.innovationRadar?.length ? (
              <div className="space-y-1.5">
                {report.innovationEvaluation.innovationRadar.map((d) => (
                  <div key={d.key} className="text-sm">
                    <span className="font-medium">{locale === "en" ? d.nameEn : d.nameZh}</span>
                    <span className="ml-2 font-mono tabular-nums text-muted-foreground">{Math.round(d.score)}</span>
                    {d.reasoning && <p className="text-xs leading-relaxed text-muted-foreground">{d.reasoning}</p>}
                  </div>
                ))}
              </div>
            ) : undefined
          }
        />

        {/* 跨域迁移(可选,后台非关键 Agent) */}
        {cross && (
          <CollapsibleSection title={s.crossDomain}>
            <div className="space-y-3">
              {cross.transferSummary && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{cross.transferSummary}</p>
              )}
              {cross.exploredDomains.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cross.exploredDomains.map((dm, i) => (
                    <Badge key={i} variant="outline">
                      {dm}
                    </Badge>
                  ))}
                </div>
              )}
              {cross.bridges.length > 0 && (
                <ul className="space-y-2">
                  {cross.bridges.map((b, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="font-medium">
                        {b.sourceField} → {b.targetField}
                      </div>
                      <p className="mt-1 text-muted-foreground">{b.techPrinciple}</p>
                      {b.transferPath && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.report.crossDomain.transferPath}: {b.transferPath}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CollapsibleSection>
        )}

        <DebateSection debate={report.debate} />
        <ArbitrationSection arbitration={report.arbitration} />
        <RawDataSection dualTrack={dualTrack} />
      </div>
    </div>
  );
}
