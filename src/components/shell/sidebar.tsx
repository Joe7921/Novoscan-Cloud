"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store/ui-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { boards } from "./boards";
import { LanguageToggle } from "./language-toggle";

// Claude Desktop 式左侧板块导航。
export function Sidebar() {
  const { t } = useTranslation();
  const activeBoard = useUIStore((s) => s.activeBoard);
  const setActiveBoard = useUIStore((s) => s.setActiveBoard);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* 品牌区 */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-none">
            {t.app.name}
          </span>
          <span className="mt-1.5 text-xs text-muted-foreground">
            {t.app.tagline}
          </span>
        </div>
      </div>

      {/* 板块导航 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {boards.map((board) => {
          const Icon = board.icon;
          const active = activeBoard === board.id;
          return (
            <button
              key={board.id}
              disabled={!board.enabled}
              onClick={() => board.enabled && setActiveBoard(board.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                !board.enabled &&
                  "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{t.nav[board.labelKey]}</span>
              {!board.enabled && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                  {t.nav.comingSoon}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 底部:语言切换 */}
      <div className="border-t border-sidebar-border p-3">
        <LanguageToggle />
      </div>
    </aside>
  );
}
