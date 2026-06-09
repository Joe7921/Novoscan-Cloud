"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { locales, localeNames } from "@/lib/i18n/dictionaries";
import { useUIStore } from "@/lib/store/ui-store";

// 中 / 英 分段切换器,放在侧边栏底部。
export function LanguageToggle() {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);

  return (
    <div className="flex items-center gap-2 px-1">
      <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-1 rounded-md bg-sidebar-accent/60 p-0.5">
        {locales.map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={cn(
              "flex-1 rounded-[5px] px-2 py-1 text-xs font-medium transition-colors",
              locale === l
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {localeNames[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
