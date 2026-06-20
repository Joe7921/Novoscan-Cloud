"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n/use-translation";
import { AGENT_ORDER, type AnalyzeState } from "@/lib/analyze/use-analyze";
import { AgentCard } from "./agent-card";

// 分析中态:总进度 + 当前阶段 + 检索摘要 + Agent 状态卡 + 实时日志 + 取消。
export function AnalyzingState({
  state,
  onCancel,
}: {
  state: Pick<AnalyzeState, "progress" | "phase" | "agents" | "logs" | "search">;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const a = t.board.analysis.analyzing;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{a.title}</h1>
        <p className="text-sm text-muted-foreground">{a.subtitle}</p>
      </header>

      {/* 总进度 + 当前阶段 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{state.phase ? a.phase[state.phase] : ""}</span>
          <span className="font-mono tabular-nums">{Math.round(state.progress)}%</span>
        </div>
        <Progress value={state.progress} />
      </div>

      {/* 检索摘要(到达后显示) */}
      {state.search && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <span>{t.report.overview.credibility}: {state.search.credibility}</span>
          <span>{t.report.rawData.papers}: {state.search.academic}</span>
          <span>{t.report.rawData.web}: {state.search.web}</span>
          <span>{t.report.rawData.github}: {state.search.github}</span>
        </div>
      )}

      {/* Agent 状态卡 */}
      <div className="grid gap-2 sm:grid-cols-2">
        {AGENT_ORDER.map((id) => (
          <AgentCard key={id} id={id} state={state.agents[id]} />
        ))}
      </div>

      {/* 实时日志 */}
      {state.logs.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{a.liveLog}</h2>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {state.logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
          {a.cancel}
        </Button>
      </div>
    </div>
  );
}
