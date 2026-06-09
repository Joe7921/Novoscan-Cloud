"use client";

import { Construction } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";

// 未启用板块的通用占位页。
export function PlaceholderBoard() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Construction className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t.board.placeholder.title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t.board.placeholder.desc}
        </p>
      </div>
    </div>
  );
}
