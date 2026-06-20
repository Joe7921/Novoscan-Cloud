"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { DebateRecord } from "@/lib/types";
import { CollapsibleSection } from "./collapsible-section";
import { Separator } from "@/components/ui/separator";

// 辩论与异议:未触发时透明说明原因;触发时展示各场辩论裁决 + 结构化异议。
export function DebateSection({ debate }: { debate: DebateRecord }) {
  const { t } = useTranslation();
  const d = t.report.debate;

  return (
    <CollapsibleSection
      title={t.report.sections.debate}
      badge={<Badge variant="muted">{debate.triggered ? d.triggered : d.notTriggered}</Badge>}
    >
      <div className="space-y-4">
        {!debate.triggered ? (
          <p className="text-sm text-muted-foreground">{debate.triggerReason}</p>
        ) : (
          <>
            {debate.sessions.map((s) => (
              <div key={s.sessionId} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {s.proAgent} vs {s.conAgent}
                  </span>
                  <Badge variant="outline">
                    {s.exchanges.length} {d.rounds}
                  </Badge>
                </div>
                {s.topic && <p className="text-xs text-muted-foreground">{s.topic}</p>}
                {s.verdict && (
                  <p className="text-sm leading-relaxed">
                    <span className="text-muted-foreground">{d.verdict}:</span> {s.verdict}
                  </p>
                )}
                {s.keyInsights.length > 0 && (
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                    {s.keyInsights.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {debate.dissentReportText && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {d.dissentTitle}
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{debate.dissentReportText}</p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
