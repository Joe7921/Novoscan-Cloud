"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

// 创新分析板块(Playground)。
// 阶段 1 只搭「输入态」外观;分析中态 / 报告态与真实引擎在阶段 5–7 接入。
export function AnalysisBoard() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.board.analysis.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.board.analysis.subtitle}
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.board.analysis.inputPlaceholder}
          rows={10}
          className="w-full resize-none rounded-xl border border-input bg-card p-4 text-sm leading-relaxed shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t.board.analysis.wip}</p>
          <Button disabled={!input.trim()}>
            {t.board.analysis.analyze}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
