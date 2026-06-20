"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { InnovationRadarDimension } from "@/lib/types";
import type { Locale } from "@/lib/i18n/dictionaries";

// 六维创新性雷达图(recharts,灰阶单色)。
// 配色策略=仅灰阶:线/填充用 foreground、网格用 border,不用彩色。
export function InnovationRadar({
  dimensions,
  locale,
}: {
  dimensions: InnovationRadarDimension[];
  locale: Locale;
}) {
  const data = dimensions.map((d) => ({
    name: locale === "en" ? d.nameEn : d.nameZh,
    score: Math.max(0, Math.min(100, d.score)),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke="var(--foreground)"
            fill="var(--foreground)"
            fillOpacity={0.12}
            strokeWidth={1.5}
            dot={{ r: 2, fill: "var(--foreground)" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
