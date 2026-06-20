"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { ConfidenceLevel } from "@/lib/types";

// 置信度徽标(灰阶;不用语义色,仅文字区分)。
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const { t } = useTranslation();
  return <Badge variant="muted">{t.report.confidence[level]}</Badge>;
}
