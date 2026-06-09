"use client";

import { useUIStore } from "@/lib/store/ui-store";
import { AnalysisBoard } from "@/components/boards/analysis/analysis-board";
import { Sidebar } from "./sidebar";
import { PlaceholderBoard } from "./placeholder-board";

// 应用外壳:左侧板块导航 + 右侧主区域。
export function AppShell() {
  const activeBoard = useUIStore((s) => s.activeBoard);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {activeBoard === "analysis" ? <AnalysisBoard /> : <PlaceholderBoard />}
      </main>
    </div>
  );
}
