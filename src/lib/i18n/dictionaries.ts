// 中英双语词典(轻量方案:客户端字典 + Zustand 存当前语言)
// 后续若需要 SEO 级多语言路由,可平滑替换为 next-intl。

export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh";

export const localeNames: Record<Locale, string> = {
  zh: "中文",
  en: "English",
};

// 以中文词典为「事实来源」,英文词典必须与其结构完全一致(由 TS 类型强制)。
const zh = {
  app: {
    name: "Novoscan",
    tagline: "尽调级创新分析平台",
  },
  nav: {
    analysis: "创新分析",
    projects: "项目状态",
    studio: "创作分发",
    memory: "记忆",
    comingSoon: "即将上线",
  },
  board: {
    analysis: {
      title: "创新分析",
      subtitle: "贴入你的想法或长文,获得一份经得起追问的可信分析报告。",
      inputPlaceholder: "在此粘贴你的创意、研究思路或长文……",
      analyze: "开始分析",
      wip: "分析引擎正在搭建中(将于阶段 3 起逐步接入)。",
    },
    placeholder: {
      title: "敬请期待",
      desc: "这个板块还在规划中,很快和你见面。",
    },
  },
  topbar: {
    language: "语言",
  },
};

export type Dictionary = typeof zh;

const en: Dictionary = {
  app: {
    name: "Novoscan",
    tagline: "Diligence-grade innovation analysis",
  },
  nav: {
    analysis: "Innovation Analysis",
    projects: "Projects",
    studio: "Studio",
    memory: "Memory",
    comingSoon: "Coming soon",
  },
  board: {
    analysis: {
      title: "Innovation Analysis",
      subtitle:
        "Paste your idea or long-form text to get a trustworthy, scrutiny-proof report.",
      inputPlaceholder:
        "Paste your idea, research direction, or long-form text here…",
      analyze: "Analyze",
      wip: "The analysis engine is under construction (wired up from Stage 3).",
    },
    placeholder: {
      title: "Coming soon",
      desc: "This section is still being planned. See you soon.",
    },
  },
  topbar: {
    language: "Language",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { zh, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
