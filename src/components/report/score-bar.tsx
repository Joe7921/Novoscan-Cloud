import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// 灰阶评分条:左标签 + 右分值 + 进度条。配色仅灰阶(高低靠长短/字重区分,不用语义色)。
export function ScoreBar({
  label,
  score,
  className,
}: {
  label: string;
  score: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-sm font-semibold tabular-nums">{Math.round(score)}</span>
      </div>
      <Progress value={score} />
    </div>
  );
}
