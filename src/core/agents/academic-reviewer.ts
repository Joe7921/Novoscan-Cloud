// 学术审查员(L1 关键路径):基于学术轨检索数据评估技术的学术基础与空白。
// 参考旧库 academicReviewer.ts 重写为 EngineTool;保留 Rubric/思维链/相似论文/截断安全设计。

import { z } from "zod";
import type { AcademicResult, AgentOutput, Language, SimilarPaper } from "@/lib/types";
import { parseAgentJSON } from "@/core/ai-client";
import { registerTool, type EngineTool } from "@/core/tools";
import {
  OUTPUT_RULES,
  domainBlock,
  languageLine,
  memoryBlock,
  normalizeAgentOutput,
  clampScore,
  asConfidence,
} from "./shared";

const inputSchema = z.object({
  query: z.string().describe("用户创意/长文"),
  academicData: z.custom<AcademicResult>((v) => !!v && typeof v === "object").describe("学术轨聚合检索结果"),
  language: z.custom<Language>((v) => v === "zh" || v === "en").describe("输出语言"),
  domainHint: z.string().optional().describe("用户指定的学科领域"),
  memoryContext: z.string().optional().describe("记忆层 RAG 注入的历史经验"),
});
type Input = z.infer<typeof inputSchema>;

function buildPrompt(input: Input): string {
  const { academicData } = input;
  const stats = academicData.stats;
  const paperCount = academicData.results?.length ?? 0;
  const topPapers =
    academicData.results
      ?.slice()
      .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
      .slice(0, 8)
      .map(
        (p) =>
          `"${p.title}" (${p.year ?? "?"}, cited:${p.citationCount ?? 0}, ${p.venue || "unknown"}, by: ${(p.authors ?? []).slice(0, 3).join(", ")})`,
      )
      .join("\n    ") || "no data";
  const paperListJson = JSON.stringify(
    academicData.results?.slice(0, 6).map((p) => ({
      title: p.title,
      year: p.year,
      citationCount: p.citationCount ?? 0,
      venue: p.venue ?? "",
      url: p.url ?? "",
    })),
    null,
    2,
  );

  return `
# 系统角色

你是一位拥有 20 年经验的学术文献审查专家,曾担任 Nature、Science 等顶级期刊的审稿人。
你的核心能力是:从学术检索数据中精准判断一个技术方向的学术成熟度和研究空白。

## 专业边界
- 你只负责学术维度的分析,不评价商业化可行性或市场竞争
- 你必须基于提供的检索数据做判断,不能凭空编造论文或引用

---

# 任务

分析以下用户创新点的学术基础:

**用户创新点**:${input.query}
${domainBlock(input.domainHint, "\n重点关注该领域的核心期刊、顶会和代表性研究者。")}${memoryBlock(input.memoryContext)}
**学术检索数据摘要**:
- 总论文数:${stats.totalPapers},去重+相关性过滤后可用论文:${paperCount} 篇
- 总引用量:${stats.totalCitations},平均引用:${Math.round(stats.avgCitation)}
- 开放获取:${stats.openAccessCount} 篇
- 数据来源:OpenAlex(${stats.bySource.openAlex}) / arXiv(${stats.bySource.arxiv}) / CrossRef(${stats.bySource.crossref}) / CORE(${stats.bySource.core})
- 高频概念:${academicData.topConcepts?.slice(0, 8).join("、") || "无"}

**引用最高的论文**:
    ${topPapers}

**论文列表(精简)**:
${paperListJson}

---

# 思维链(请按以下步骤逐步推理)

**Step 1 - 数据特征扫描**:统计论文年份分布、引用分布、来源分布,识别异常值
**Step 2 - 技术成熟度判定**:基于论文数量和引用数量判断技术处于哪个阶段
**Step 3 - 相关性评估**:Top 5 论文与用户创新点的相关程度(精确匹配/部分重叠/仅主题相关)
**Step 4 - 学术空白识别**:用户创新点在现有研究中是否存在空白
**Step 5 - 趋势判断**:近 2 年论文占比、引用增长趋势

---

# 评分标准(Rubric)

## 综合评分(0-100)含义:
| 区间 | 含义 | 依据 |
|------|------|------|
| 81-100 | 学术空白大,该方向极少被研究 | 论文 < 3 篇且无高引 |
| 61-80 | 有一定学术基础但存在明显空白 | 论文 5-15 篇,用户创新点与现有研究有差异 |
| 41-60 | 学术基础中等,空白有限 | 论文 > 15 篇,部分方向已被覆盖 |
| 21-40 | 学术研究较成熟 | 高引论文多,差异空间小 |
| 0-20 | 该方向已被充分研究 | 大量高引论文直接覆盖用户创新点 |

## 5 个评分维度:
1. **技术成熟度**(0-100):技术在学术界处于什么阶段(越成熟分越低,因为更难创新)
2. **论文覆盖度**(0-100):现有论文对用户创新方向的覆盖程度(覆盖越少分越高)
3. **学术空白**(0-100):用户创新点填补学术空白的程度
4. **引用密度**(0-100):领域引用密度反映的学术关注度(高关注 = 高竞争,分数适中)
5. **发展趋势**(0-100):近年研究增长趋势(快速增长表明方向正确)

---

# 高相似度论文评估(核心任务)

你必须从上面的论文列表中,挑选与用户创新点**语义最相似**的论文(最多 6 篇),逐篇深度对比:

1. **similarityScore(0-100)**:这是**语义相似度**,不是引用量或年份评分。90-100=核心方法论几乎完全重叠;70-89=解决同一问题但方法有差异;50-69=相关领域但方向不同;30-49=仅主题宽泛相关;0-29=几乎无关
2. **keyDifference**:一句精准的差异分析(如"该论文用监督学习,用户方案用无监督方法"),绝不能是摘要截取
3. **description**:一句话概括论文做了什么
4. **authorityLevel**:"high"=顶刊顶会或引用>100;"medium"=知名期刊或引用 20-100;"low"=普通来源或引用<20
5. **url/venue/citationCount**:从论文列表原样取用,不得编造

---

# 自检 Checklist(输出前检查)

- [ ] 每个关键结论是否都引用了具体论文标题或统计数据?
- [ ] 综合评分是否与 5 个维度评分的加权逻辑一致?
- [ ] 置信度等级是否与数据充分程度匹配?(数据不足应标 low)
- [ ] similarPapers 的 similarityScore 是否为真正的语义相似度、keyDifference 是否为差异分析?

---

# 输出格式

${languageLine(input.language)}
${OUTPUT_RULES}
{
  "agentName": "学术审查员",
  "score": 0,
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "有 ${paperCount} 篇论文支撑分析,数据来源覆盖…",
  "analysis": "最终分析结论(2-4段,包含具体论文引用)",
  "dimensionScores": [
    { "name": "技术成熟度", "score": 0, "reasoning": "你的真实推理(50字内)" },
    { "name": "论文覆盖度", "score": 0, "reasoning": "…" },
    { "name": "学术空白", "score": 0, "reasoning": "…" },
    { "name": "引用密度", "score": 0, "reasoning": "…" },
    { "name": "发展趋势", "score": 0, "reasoning": "…" }
  ],
  "similarPapers": [
    { "title": "论文完整标题", "year": 2024, "similarityScore": 0, "keyDifference": "…", "description": "…", "authors": "Author1, Author2", "url": "…", "citationCount": 0, "venue": "…", "authorityLevel": "high" }
  ],
  "keyFindings": ["发现1(引用具体论文)", "发现2", "发现3"],
  "redFlags": ["风险1"],
  "evidenceSources": ["论文标题1", "论文标题2", "OpenAlex 检索 ${stats.bySource.openAlex} 条"],
  "reasoning": "按 Step1-5 的完整推理过程(放最后,截断安全)"
}`;
}

/** 归一化 similarPapers(夹评分、滤脏条目)。 */
function normalizeSimilarPapers(value: unknown): SimilarPaper[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && typeof p.title === "string")
    .slice(0, 6)
    .map((p) => ({
      title: String(p.title),
      year: typeof p.year === "number" || typeof p.year === "string" ? p.year : "?",
      similarityScore: clampScore(p.similarityScore, 0),
      keyDifference: typeof p.keyDifference === "string" ? p.keyDifference : "",
      description: typeof p.description === "string" ? p.description : undefined,
      authors: typeof p.authors === "string" ? p.authors : undefined,
      url: typeof p.url === "string" ? p.url : undefined,
      citationCount: typeof p.citationCount === "number" ? p.citationCount : undefined,
      venue: typeof p.venue === "string" ? p.venue : undefined,
      authorityLevel: asConfidence(p.authorityLevel, "low"),
    }));
}

export const academicReviewerTool: EngineTool<Input, AgentOutput> = {
  id: "agent.academic",
  category: "agent",
  title: { zh: "学术审查员", en: "Academic Reviewer" },
  description:
    "基于学术检索数据评估创意的学术基础:技术成熟度、论文覆盖度、学术空白、引用密度、趋势,并产出高相似论文对比。输入创意 + 学术轨结果。",
  inputSchema,
  async execute(input, ctx) {
    const { text } = await ctx.callAI({
      prompt: buildPrompt(input),
      maxOutputTokens: 16_384, // 中文 reasoning + 相似论文列表体积大,沿用旧库经验值
      timeoutMs: 180_000, // 相似论文逐篇对比推理极长(实测>110s);慢非瞬障,单次长跑优于多次重试
      abortSignal: ctx.abortSignal,
    });
    const raw = parseAgentJSON<Partial<AgentOutput>>(text);
    const out = normalizeAgentOutput(raw, "学术审查员");
    out.similarPapers = normalizeSimilarPapers((raw as Record<string, unknown>).similarPapers);
    return out;
  },
};

registerTool(academicReviewerTool);
