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
      analyzeAgain: "分析新创意",
      // 分析中态
      analyzing: {
        title: "正在分析",
        subtitle: "多位 AI 专家正在分层分析,过程实时透明。",
        cancel: "取消分析",
        liveLog: "实时日志",
        phase: {
          cache: "查询缓存",
          memory: "召回历史经验",
          search: "双轨检索(学术 + 产业)",
          pipeline: "多 Agent 分层分析",
          persist: "沉淀缓存与记忆",
        },
        agents: {
          academic: "学术审查员",
          industry: "产业分析员",
          competitor: "竞品侦探",
          crossDomain: "跨域侦察兵",
          innovation: "创新评估师",
          debate: "辩论裁判",
          arbitration: "仲裁员",
          quality: "质检",
        },
        status: {
          pending: "等待中",
          running: "分析中",
          done: "已完成",
          failed: "部分结果",
        },
      },
      error: {
        title: "分析未能完成",
        retry: "重试",
      },
    },
    placeholder: {
      title: "敬请期待",
      desc: "这个板块还在规划中,很快和你见面。",
    },
  },
  report: {
    fromCacheBadge: "缓存结果",
    refresh: "刷新重生成",
    elapsed: "耗时",
    partialBanner: "部分结果或低置信:有专家超时降级,或仲裁标记为部分结论,请谨慎参考。",
    overview: {
      title: "结论概览",
      overallScore: "综合评分",
      recommendation: "推荐结论",
      credibility: "可信度",
      consensus: "专家共识",
    },
    consensusLevels: {
      strong: "强共识",
      moderate: "中等共识",
      weak: "分歧较大",
    },
    confidence: {
      high: "高置信",
      medium: "中置信",
      low: "低置信",
    },
    common: {
      empty: "无",
      score: "评分",
      analysis: "分析",
      keyFindings: "关键发现",
      redFlags: "风险红旗",
      evidence: "引用证据",
      reasoning: "推理过程",
    },
    radar: {
      title: "六维创新性雷达",
    },
    sections: {
      academic: "学术审查",
      industry: "产业分析",
      competitor: "竞品格局",
      innovation: "创新评估",
      crossDomain: "跨域迁移",
      debate: "辩论与异议",
      arbitration: "仲裁加权透明",
      rawData: "原始数据",
    },
    similarPapers: {
      title: "高相似度论文",
      similarity: "相似度",
      keyDifference: "核心差异",
      viewSource: "查看原文",
    },
    arbitration: {
      weightTitle: "加权评分明细",
      colAgent: "维度",
      colRaw: "原始分",
      colWeight: "权重",
      colWeighted: "加权分",
      total: "加权总分",
      summary: "仲裁结论",
      nextSteps: "下一步建议",
      dissent: "少数派异议",
      conflicts: "已化解的冲突",
      dims: {
        academic: "学术",
        industry: "产业",
        innovation: "创新",
        competitor: "竞品",
      },
    },
    debate: {
      triggered: "已触发对抗辩论",
      notTriggered: "未触发辩论",
      rounds: "轮",
      verdict: "裁决",
      dissentTitle: "结构化异议",
      keyInsights: "关键洞察",
    },
    crossDomain: {
      bridges: "跨域桥梁",
      domains: "探索领域",
      transferPath: "迁移路径",
      novelty: "新颖潜力",
    },
    rawData: {
      papers: "学术论文",
      web: "产业资讯",
      github: "开源项目",
      stars: "星标",
      noSnapshot: "缓存命中,本次未保留原始检索快照。",
      credibilityReasoning: "可信度依据",
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
      analyzeAgain: "Analyze a new idea",
      analyzing: {
        title: "Analyzing",
        subtitle: "Multiple AI experts are analyzing in layers, fully transparent in real time.",
        cancel: "Cancel",
        liveLog: "Live log",
        phase: {
          cache: "Checking cache",
          memory: "Recalling past experience",
          search: "Dual-track retrieval (academic + industry)",
          pipeline: "Multi-agent layered analysis",
          persist: "Persisting cache & memory",
        },
        agents: {
          academic: "Academic Reviewer",
          industry: "Industry Analyst",
          competitor: "Competitor Detective",
          crossDomain: "Cross-domain Scout",
          innovation: "Innovation Evaluator",
          debate: "Debate Judge",
          arbitration: "Arbitrator",
          quality: "Quality Check",
        },
        status: {
          pending: "Pending",
          running: "Analyzing",
          done: "Done",
          failed: "Partial",
        },
      },
      error: {
        title: "Analysis could not complete",
        retry: "Retry",
      },
    },
    placeholder: {
      title: "Coming soon",
      desc: "This section is still being planned. See you soon.",
    },
  },
  report: {
    fromCacheBadge: "Cached",
    refresh: "Regenerate",
    elapsed: "Took",
    partialBanner:
      "Partial or low-confidence result: some experts timed out and degraded, or arbitration flagged a partial conclusion. Interpret with care.",
    overview: {
      title: "Verdict overview",
      overallScore: "Overall score",
      recommendation: "Recommendation",
      credibility: "Credibility",
      consensus: "Expert consensus",
    },
    consensusLevels: {
      strong: "Strong consensus",
      moderate: "Moderate consensus",
      weak: "Significant disagreement",
    },
    confidence: {
      high: "High confidence",
      medium: "Medium confidence",
      low: "Low confidence",
    },
    common: {
      empty: "None",
      score: "Score",
      analysis: "Analysis",
      keyFindings: "Key findings",
      redFlags: "Red flags",
      evidence: "Cited evidence",
      reasoning: "Reasoning",
    },
    radar: {
      title: "Six-dimension innovation radar",
    },
    sections: {
      academic: "Academic review",
      industry: "Industry analysis",
      competitor: "Competitive landscape",
      innovation: "Innovation evaluation",
      crossDomain: "Cross-domain transfer",
      debate: "Debate & dissent",
      arbitration: "Weighted arbitration",
      rawData: "Raw data",
    },
    similarPapers: {
      title: "Highly similar papers",
      similarity: "Similarity",
      keyDifference: "Key difference",
      viewSource: "View source",
    },
    arbitration: {
      weightTitle: "Weighted score breakdown",
      colAgent: "Dimension",
      colRaw: "Raw",
      colWeight: "Weight",
      colWeighted: "Weighted",
      total: "Weighted total",
      summary: "Arbitration verdict",
      nextSteps: "Next steps",
      dissent: "Minority dissent",
      conflicts: "Resolved conflicts",
      dims: {
        academic: "Academic",
        industry: "Industry",
        innovation: "Innovation",
        competitor: "Competitor",
      },
    },
    debate: {
      triggered: "Adversarial debate triggered",
      notTriggered: "Debate not triggered",
      rounds: "rounds",
      verdict: "Verdict",
      dissentTitle: "Structured dissent",
      keyInsights: "Key insights",
    },
    crossDomain: {
      bridges: "Cross-domain bridges",
      domains: "Explored domains",
      transferPath: "Transfer path",
      novelty: "Novelty potential",
    },
    rawData: {
      papers: "Academic papers",
      web: "Industry sources",
      github: "Open-source projects",
      stars: "stars",
      noSnapshot: "Cache hit; no raw retrieval snapshot was kept for this run.",
      credibilityReasoning: "Credibility rationale",
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
