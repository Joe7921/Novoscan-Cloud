"use client";

import { AlertTriangle, Check, Circle, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";
import type { AgentId, AgentUiState } from "@/lib/analyze/use-analyze";

// 单个 Agent 状态卡:图标 + 名称 + 状态 + 实时思考(若引擎有 agent_thinking 流)。
export function AgentCard({ id, state }: { id: AgentId; state: AgentUiState }) {
  const { t } = useTranslation();
  const a = t.board.analysis.analyzing;
  const { status, thinking } = state;

  const Icon =
    status === "done" ? Check : status === "failed" ? AlertTriangle : status === "running" ? Loader2 : Circle;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 transition-colors",
        status === "pending" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            status === "running" && "animate-spin text-foreground",
            status === "done" && "text-foreground",
            status === "failed" && "text-destructive",
            status === "pending" && "text-muted-foreground",
          )}
        />
        <span className="flex-1 text-sm font-medium">{a.agents[id]}</span>
        <span
          className={cn(
            "text-xs",
            status === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {a.status[status]}
        </span>
      </div>
      {thinking && (
        <p className="mt-2 line-clamp-3 pl-7 text-xs leading-relaxed text-muted-foreground">{thinking}</p>
      )}
    </div>
  );
}
