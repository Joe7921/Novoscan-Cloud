"use client";

import { getDictionary } from "./dictionaries";
import { useUIStore } from "@/lib/store/ui-store";

// 读取当前语言的词典。组件里这样用:const { t } = useTranslation(); t.nav.analysis
export function useTranslation() {
  const locale = useUIStore((s) => s.locale);
  return { t: getDictionary(locale), locale };
}
