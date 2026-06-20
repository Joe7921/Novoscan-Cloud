"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { ArbitrationResult, WeightedScoreItem } from "@/lib/types";
import { CollapsibleSection } from "./collapsible-section";
import { FieldList } from "./field-list";

// 仲裁加权透明:原始分 → 权重 → 加权分 整表 + 结论 + 下一步 + 共识/异议。
// weightedBreakdown 由引擎代码预计算回填(透明、可核对)。
export function ArbitrationSection({ arbitration }: { arbitration: ArbitrationResult }) {
  const { t } = useTranslation();
  const a = t.report.arbitration;
  const w = arbitration.weightedBreakdown;

  const rows: Array<{ label: string; item: WeightedScoreItem }> = [
    { label: a.dims.academic, item: w.academic },
    { label: a.dims.industry, item: w.industry },
    { label: a.dims.innovation, item: w.innovation },
    { label: a.dims.competitor, item: w.competitor },
  ];
  const totalWeighted = rows.reduce((s, r) => s + (r.item.weighted || 0), 0);

  return (
    <CollapsibleSection
      title={t.report.sections.arbitration}
      defaultOpen
      badge={<Badge variant="muted">{t.report.consensusLevels[arbitration.consensusLevel]}</Badge>}
    >
      <div className="space-y-4">
        {arbitration.summary && <p className="text-sm leading-relaxed whitespace-pre-wrap">{arbitration.summary}</p>}

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{a.colAgent}</th>
                <th className="px-3 py-2 text-right font-medium">{a.colRaw}</th>
                <th className="px-3 py-2 text-right font-medium">{a.colWeight}</th>
                <th className="px-3 py-2 text-right font-medium">{a.colWeighted}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{Math.round(r.item.raw)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {(r.item.weight * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.item.weighted.toFixed(1)}</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/30 font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  {a.total}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{totalWeighted.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {arbitration.nextSteps.length > 0 && (
          <FieldList title={a.nextSteps} items={arbitration.nextSteps} kind="finding" emptyText={t.report.common.empty} />
        )}
        {arbitration.conflictsResolved.length > 0 && (
          <FieldList
            title={a.conflicts}
            items={arbitration.conflictsResolved}
            kind="evidence"
            emptyText={t.report.common.empty}
          />
        )}
        {arbitration.dissent.length > 0 && (
          <FieldList title={a.dissent} items={arbitration.dissent} kind="flag" emptyText={t.report.common.empty} />
        )}
      </div>
    </CollapsibleSection>
  );
}
