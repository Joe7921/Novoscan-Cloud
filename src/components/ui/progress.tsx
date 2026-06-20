import { cn } from "@/lib/utils";

// 进度条(灰阶)。value 0-100。用于分析中态总进度与报告评分条。
function Progress({
  value,
  className,
  indicatorClassName,
  ...props
}: React.ComponentProps<"div"> & { value: number; indicatorClassName?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full bg-foreground/80 transition-[width] duration-500", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
