"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import type { AgentOutput } from "@/lib/types";
import { CollapsibleSection } from "./collapsible-section";
import { ConfidenceBadge } from "./confidence-badge";
import { FieldList } from "./field-list";
import { ScoreBar } from "./score-bar";

// 学术/产业/竞品/创新 通用呈现块:分析文本 + 评分 + 关键发现 + 红旗 + 证据。
// extra 用于注入各 Agent 特有内容(如学术的相似论文、创新的雷达图)。
export function AgentSection({
  title,
  output,
  defaultOpen = false,
  extra,
}: {
  title: string;
  output: AgentOutput;
  defaultOpen?: boolean;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const c = t.report.common;

  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      badge={
        <span className="flex items-center gap-2">
          <ConfidenceBadge level={output.confidence} />
          <span className="font-mono text-sm font-semibold tabular-nums">{Math.round(output.score)}</span>
        </span>
      }
    >
      <div className="space-y-4">
        <ScoreBar label={c.score} score={output.score} />
        {output.analysis && <p className="text-sm leading-relaxed whitespace-pre-wrap">{output.analysis}</p>}
        {extra}
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldList title={c.keyFindings} items={output.keyFindings} kind="finding" emptyText={c.empty} />
          <FieldList title={c.redFlags} items={output.redFlags} kind="flag" emptyText={c.empty} />
        </div>
        {output.evidenceSources.length > 0 && (
          <FieldList title={c.evidence} items={output.evidenceSources} kind="evidence" emptyText={c.empty} />
        )}
      </div>
    </CollapsibleSection>
  );
}
