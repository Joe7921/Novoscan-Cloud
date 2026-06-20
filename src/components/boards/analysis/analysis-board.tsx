"use client";

import { useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useAnalyze } from "@/lib/analyze/use-analyze";
import { ReportView } from "@/components/report/report-view";
import { InputState } from "./input-state";
import { AnalyzingState } from "./analyzing-state";

// 创新分析板块:据分析状态机切四态——输入 / 分析中 / 报告 / 错误。
export function AnalysisBoard() {
  const { t, locale } = useTranslation();
  const analyze = useAnalyze();
  const lastQuery = useRef("");

  const run = (query: string, refresh = false) => {
    lastQuery.current = query;
    void analyze.start({ query, language: locale, refresh });
  };

  if (analyze.status === "idle") {
    return <InputState onSubmit={(q) => run(q)} />;
  }

  if (analyze.status === "analyzing") {
    return <AnalyzingState state={analyze} onCancel={analyze.reset} />;
  }

  if (analyze.status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-20 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{t.board.analysis.error.title}</h1>
          {analyze.error && <p className="text-sm text-muted-foreground">{analyze.error}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => lastQuery.current && run(lastQuery.current)}>{t.board.analysis.error.retry}</Button>
          <Button variant="ghost" onClick={analyze.reset}>
            {t.board.analysis.analyzeAgain}
          </Button>
        </div>
      </div>
    );
  }

  // status === "done"
  if (analyze.report) {
    return (
      <ReportView
        report={analyze.report}
        dualTrack={analyze.dualTrack}
        fromCache={analyze.fromCache}
        elapsedMs={analyze.elapsedMs}
        onRefresh={() => lastQuery.current && run(lastQuery.current, true)}
        onReset={analyze.reset}
      />
    );
  }

  return <InputState onSubmit={(q) => run(q)} />;
}
