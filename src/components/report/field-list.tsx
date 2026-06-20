import { AlertTriangle, Check, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "finding" | "flag" | "evidence";

const ICONS = {
  finding: Check,
  flag: AlertTriangle,
  evidence: Quote,
} as const;

// 报告里的要点列表(关键发现/红旗/证据)。红旗走 destructive 红,其余灰阶。
export function FieldList({
  title,
  items,
  kind,
  emptyText,
}: {
  title: string;
  items: string[];
  kind: Kind;
  emptyText: string;
}) {
  const Icon = ICONS[kind];
  const isFlag = kind === "flag";
  return (
    <div className="space-y-1.5">
      <h4 className={cn("text-xs font-semibold tracking-wide uppercase", isFlag ? "text-destructive" : "text-muted-foreground")}>
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", isFlag ? "text-destructive" : "text-muted-foreground")} />
              <span className={cn(isFlag && "text-destructive")}>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
