// 竞品侦探(L1 关键路径):拆解竞品格局与差异化空间。
// 参考旧库 competitorDetective.ts 重写为 EngineTool;保留「竞品≠开源项目」核心纠偏与竞品分层/SWOT 思维链。

import { z } from "zod";
import type { AgentOutput, IndustryResult, Language } from "@/lib/types";
import { parseAgentJSON } from "@/core/ai-client";
import { registerTool, type EngineTool } from "@/core/tools";
import {
  OUTPUT_RULES,
  domainBlock,
  languageLine,
  memoryBlock,
  normalizeAgentOutput,
} from "./shared";

const inputSchema = z.object({
  query: z.string().describe("用户创意/长文"),
  industryData: z.custom<IndustryResult>((v) => !!v && typeof v === "object").describe("产业轨聚合检索结果"),
  language: z.custom<Language>((v) => v === "zh" || v === "en").describe("输出语言"),
  domainHint: z.string().optional().describe("用户指定的学科领域"),
  memoryContext: z.string().optional().describe("记忆层 RAG 注入的历史经验"),
});
type Input = z.infer<typeof inputSchema>;

function buildPrompt(input: Input): string {
  const d = input.industryData;
  const githubRepos = d.githubRepos ?? [];
  const webResults = d.webResults ?? [];
  const topRepos =
    githubRepos
      .slice()
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
      .slice(0, 5)
      .map((r) => `${r.name} (⭐${r.stars ?? 0}, 活跃度: ${r.health ?? "未知"}, Topics: ${(r.topics ?? []).join(", ")})`)
      .join("\n    ") || "无";
  const highStarCount = githubRepos.filter((r) => (r.stars ?? 0) > 5000).length;
  const productPages = webResults.filter(
    (w) =>
      w.title?.toLowerCase().includes("product") ||
      w.url?.includes("producthunt") ||
      w.title?.toLowerCase().includes("pricing"),
  ).length;
  const dataJson = JSON.stringify(
    {
      githubRepos: githubRepos.slice(0, 5).map((r) => ({
        name: r.name,
        stars: r.stars ?? 0,
        health: r.health ?? "unknown",
        language: r.language ?? "",
        topics: (r.topics ?? []).slice(0, 5),
        description: (r.description ?? "").slice(0, 100),
      })),
      webResults: webResults.slice(0, 5).map((w) => ({
        title: (w.title ?? "").slice(0, 80),
        url: w.url,
        snippet: (w.snippet ?? w.description ?? "").slice(0, 120),
      })),
      topProjects: d.topProjects?.slice(0, 3),
    },
    null,
    2,
  );

  return `
# 系统角色

你是一位拥有 15 年经验的竞争情报分析师,曾为 Google Ventures、红杉资本提供竞品情报服务。
你的核心能力是:从公开数据中精准识别竞争格局、拆解竞品技术栈、发现差异化突破口。

## 专业边界
- 你专注于竞品层面的分析,不做学术论文评审或宏观市场规模估算
- 你必须基于提供的数据做判断,明确标注哪些是有数据支撑的结论、哪些是推测
- 涉及敏感内容时,专注于技术层面分析,避免政治/社会评论
- ⚠️⚠️ **核心纠偏(最高优先级规则)**:
  1. "竞品" **不等于** "开源项目"。GitHub 上能搜到的项目仅代表开源生态中的竞争者,通常只是整个竞争格局的冰山一角(不到 10%)。
  2. 你必须同时考虑非开源竞品来源:商业闭源产品(从网页中识别产品页/定价页)、大厂内部工具、企业级 SaaS/PaaS、行业垂直软件等。
  3. GitHub Star/活跃度仅用于分析**开源生态**的竞争强度,不能代表整个市场。
  4. **评分约束**:纯 GitHub 指标(Star/Fork/Issue)在竞争密度评分中权重不得超过 20%。

---

# 任务

以"竞品情报报告"的标准,分析用户创新点面临的竞争格局:

**用户创新点**:${input.query}
${domainBlock(input.domainHint, "\n以该领域头部玩家和标志性产品为竞品基准,SWOT 对标基于该领域的竞争规则。")}${memoryBlock(input.memoryContext)}
**竞品检索数据摘要**:
- GitHub 相关项目:${githubRepos.length} 个(其中 > 5000⭐ 的有 ${highStarCount} 个)
- 网页搜索结果:${webResults.length} 条(其中疑似产品页 ${productPages} 个)
- 市场热度信号:${d.sentiment}

**Top GitHub 项目(按 Star 排序)**:
    ${topRepos}

**竞品数据(精简)**:
${dataJson}

---

# 思维链(请按以下步骤逐步推理)

**Step 1 - 竞品全景扫描**:从所有数据源识别潜在竞品(商业闭源产品 / 开源项目 / 大厂潜在方案 / 行业垂直 SaaS)
**Step 2 - 竞品分层**:直接竞品(同问题同用户)/ 间接竞品(相似问题或不同方式)/ 潜在威胁(大厂入局、通用平台覆盖)
**Step 3 - 核心竞品深度拆解**:对 Top 3 直接竞品分析技术能力、市场地位、商业模式、护城河
**Step 4 - SWOT 对标**:用户创新点 vs 最强竞品
**Step 5 - 差异化机会总结**:找到竞品的集体弱点

---

# 评分标准(Rubric)

## 综合评分(0-100)含义——用户创新点的竞争优势:
| 区间 | 含义 |
|------|------|
| 81-100 | 几乎无直接竞品,差异化空间极大 |
| 61-80 | 竞品较少或较弱,用户有明显差异化优势 |
| 41-60 | 有一定竞品但存在差异化空间 |
| 21-40 | 竞品成熟,差异化空间有限 |
| 0-20 | 已有巨头/成熟产品垄断,进入极其困难 |

## 4 个评分维度:
1. **竞争密度**(0-100):竞品越少分越高
2. **技术护城河**(0-100):用户创意是否有技术壁垒保护
3. **差异化空间**(0-100):与现有竞品的差异化程度
4. **进入壁垒**(0-100):进入该领域的难度(对用户而言越容易分越高)

---

# 自检 Checklist(输出前检查)

- [ ] 是否为每个竞品引用了 GitHub 名称或网页标题?
- [ ] SWOT 分析是否有数据支撑而非主观臆断?
- [ ] "推测"内容是否明确标注了"推测"?
- [ ] 评分与竞品数量/质量的分析是否逻辑一致?

---

# 输出格式

${languageLine(input.language)}
${OUTPUT_RULES}
{
  "agentName": "竞品侦探",
  "score": 0,
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于 ${githubRepos.length} 个 GitHub 项目和 ${webResults.length} 条网页的分析…",
  "analysis": "最终分析结论(含竞品矩阵和 SWOT)",
  "dimensionScores": [
    { "name": "竞争密度", "score": 0, "reasoning": "你的真实推理(50字内)" },
    { "name": "技术护城河", "score": 0, "reasoning": "…" },
    { "name": "差异化空间", "score": 0, "reasoning": "…" },
    { "name": "进入壁垒", "score": 0, "reasoning": "…" }
  ],
  "keyFindings": ["发现1(引用具体竞品)", "发现2", "发现3"],
  "redFlags": ["风险1"],
  "evidenceSources": ["GitHub: 项目名", "网页: 标题"],
  "reasoning": "按 Step1-5 的完整推理过程(放最后,截断安全)"
}`;
}

export const competitorDetectiveTool: EngineTool<Input, AgentOutput> = {
  id: "agent.competitor",
  category: "agent",
  title: { zh: "竞品侦探", en: "Competitor Detective" },
  description:
    "基于产业检索数据拆解创意的竞争格局:竞争密度、技术护城河、差异化空间、进入壁垒,含竞品分层与 SWOT。输入创意 + 产业轨结果。",
  inputSchema,
  async execute(input, ctx) {
    const { text } = await ctx.callAI({
      prompt: buildPrompt(input),
      maxOutputTokens: 16_384,
      timeoutMs: 110_000,
      abortSignal: ctx.abortSignal,
    });
    return normalizeAgentOutput(parseAgentJSON<Partial<AgentOutput>>(text), "竞品侦探");
  },
};

registerTool(competitorDetectiveTool);
