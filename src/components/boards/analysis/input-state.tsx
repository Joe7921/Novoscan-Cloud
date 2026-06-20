"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

// 输入态:粘贴创意/长文 → 开始分析。
export function InputState({ onSubmit }: { onSubmit: (query: string) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const trimmed = input.trim();

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.board.analysis.title}</h1>
        <p className="text-sm text-muted-foreground">{t.board.analysis.subtitle}</p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.board.analysis.inputPlaceholder}
          rows={10}
          className="w-full resize-none rounded-xl border border-input bg-card p-4 text-sm leading-relaxed shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />

        <div className="flex items-center justify-end">
          <Button disabled={!trimmed} onClick={() => trimmed && onSubmit(trimmed)}>
            {t.board.analysis.analyze}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
