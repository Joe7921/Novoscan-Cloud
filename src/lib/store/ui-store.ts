"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultLocale, type Locale } from "@/lib/i18n/dictionaries";

// 板块标识:与 components/shell/boards.ts 中的板块定义对应。
export type BoardId = "analysis" | "projects" | "studio" | "memory";

interface UIState {
  locale: Locale;
  activeBoard: BoardId;
  setLocale: (locale: Locale) => void;
  setActiveBoard: (board: BoardId) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      activeBoard: "analysis",
      setLocale: (locale) => set({ locale }),
      setActiveBoard: (activeBoard) => set({ activeBoard }),
    }),
    {
      name: "novoscan-ui",
      // 关闭自动注水,改为客户端挂载后手动 rehydrate(见 components/providers.tsx),
      // 避免「服务端默认值 vs 本地存储值」造成的 hydration 不匹配警告。
      skipHydration: true,
    },
  ),
);
