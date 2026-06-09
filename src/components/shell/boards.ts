import { Brain, FlaskConical, FolderKanban, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BoardId } from "@/lib/store/ui-store";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// 左侧板块导航定义(Claude Desktop 式)。
// enabled=false 的板块在阶段 1 仅占位,显示「即将上线」。
export interface BoardDef {
  id: BoardId;
  icon: LucideIcon;
  labelKey: keyof Dictionary["nav"];
  enabled: boolean;
}

export const boards: BoardDef[] = [
  { id: "analysis", icon: FlaskConical, labelKey: "analysis", enabled: true },
  { id: "projects", icon: FolderKanban, labelKey: "projects", enabled: false },
  { id: "studio", icon: PenLine, labelKey: "studio", enabled: false },
  { id: "memory", icon: Brain, labelKey: "memory", enabled: false },
];
