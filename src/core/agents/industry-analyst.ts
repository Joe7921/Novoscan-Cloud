// 产业分析员(L1 关键路径):基于产业轨检索数据评估市场成熟度与商业化可行性。
// 参考旧库 industryAnalyst.ts 重写为 EngineTool;保留「GitHub 权重≤15%」核心纠偏与信号矩阵思维链。

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
  const webCount = d.webResults?.length ?? 0;
  const githubCount = d.githubRepos?.length ?? 0;
  const topProjects =
    d.topProjects?.map((p) => `${p.name} (${p.stars}⭐, 状态: ${p.health})`).join("\n    ") || "无";
  const topWebResults =
    d.webResults
      ?.slice(0, 5)
      .map((w) => `"${w.title}" - ${w.url}`)
      .join("\n    ") || "无";
  const dataJson = JSON.stringify(
    {
      webResults: d.webResults?.slice(0, 6).map((w) => ({
        title: (w.title ?? "").slice(0, 80),
        url: w.url,
        snippet: (w.snippet ?? w.description ?? "").slice(0, 120),
      })),
      githubRepos: d.githubRepos?.slice(0, 5).map((r) => ({
        name: r.name,
        stars: r.stars ?? 0,
        health: r.health ?? "unknown",
        topics: (r.topics ?? []).slice(0, 5),
        language: r.language ?? "",
      })),
      topProjects: d.topProjects?.slice(0, 3),
    },
    null,
    2,
  );

  return `
# 系统角色

你是一位硅谷顶级产品战略分析师,曾在 McKinsey 和 a16z 担任技术投资顾问。
你的核心能力是:从产业检索数据中精准判断一个技术方向的市场格局和商业化前景。

## 专业边界
- 你只负责产业/市场维度的分析,不评价学术创新性
- 你必须基于提供的检索数据做判断,引用具体的项目名称和数据
- 涉及敏感内容时,专注于技术层面分析,避免政治/社会评论
- ⚠️⚠️ **核心纠偏(最高优先级规则)**:
  1. GitHub 开源项目数量 **禁止** 作为市场阶段判定的决定性依据。开源生态仅占整个商业技术市场的很小一部分(通常不到 10%)。
  2. 没有 GitHub 项目 **绝不等于** 产业应用空白。大量高价值技术(企业安全、底层优化、核心算法、行业垂直软件等)作为商业机密从不开源,但已在产业界广泛部署。
  3. 你必须基于"该技术解决的商业痛点是否刚需"、"企业采购/内部开发的可能性"、"网页中的商业信号(产品页/定价/案例/招聘)"进行产业成熟度推理。
  4. **评分公式约束**:GitHub 数据(项目数、Star 数)在你的评分推理中权重不得超过 15%。

---

# 任务

分析以下用户创新点的产业格局:

**用户创新点**:${input.query}
${domainBlock(input.domainHint, "\n以该领域的市场规模、行业标杆企业和增长逻辑为评估基准。")}${memoryBlock(input.memoryContext)}
**产业检索数据摘要**:
- 网页搜索结果:${webCount} 条(已过相关性闸门)
- GitHub 相关项目:${githubCount} 个
- 市场热度:${d.sentiment}
- 是否有开源实现:${d.hasOpenSource ? "是" : "否"}

**Top GitHub 项目**:
    ${topProjects}

**Top 网页结果**:
    ${topWebResults}

**产业数据(精简)**:
${dataJson}

---

# 思维链(请按以下步骤逐步推理)

**Step 1 - 市场信号矩阵**:
| 信号 | 权重 | 数据依据 |
|------|------|---------|
| 搜索结果量 | 高 | ${webCount} 条 → 市场关注度 |
| 商业落地推理 | 高 | 该技术解决的商业痛点是否刚需?企业采购/内部开发的可能性?很多高价值技术不开源但已广泛部署 |
| 产品/企业信号 | 中 | 网页中是否出现企业产品页、定价页、案例研究、招聘信息等商业化信号 |
| 网页来源类型 | 中 | 产品页/定价页 vs 新闻 vs 博客的比例 → 判断是否已有商业产品 |
| GitHub 项目数 | 低(仅参考) | ${githubCount} 个 → 仅反映开源生态活跃度,不代表产业全貌 |
| 项目 Star 数 | 低(仅参考) | 开源热度 ≠ 产业热度 |

**Step 2 - 市场阶段判定**(必须结合"商业落地推理",GitHub 数据仅参考):
- 概念期(< 3 条网页 + 无商业产品信号 + 技术痛点尚不明确)
- 早期(3-10 条网页 + 少量产品/技术博客 + 痛点存在但市场尚未规模化)
- 成长期(10+ 条网页 + 出现企业产品/案例研究/行业报告 + 可推理出企业级需求)
- 红海期(20+ 条网页 + 多个商业产品/定价页 + 大厂入局信号 + 行业招聘活跃)

**Step 3 - 竞争格局速写**:列出主要玩家及其定位
**Step 4 - 商业化路径评估**:最可行的变现方式
**Step 5 - 时机判断**:现在进入是太早、刚好、还是太晚?

---

# 评分标准(Rubric)

## 综合评分(0-100)含义:
| 区间 | 含义 |
|------|------|
| 81-100 | 蓝海市场,几乎无竞争,时机极佳 |
| 61-80 | 早期市场,竞争有限,有差异化空间 |
| 41-60 | 成长市场,有一定竞争但仍有机会 |
| 21-40 | 竞争激烈,差异化空间有限 |
| 0-20 | 红海市场,巨头垄断,不建议进入 |

## 4 个评分维度:
1. **市场验证度**(0-100):市场是否已验证该需求存在(信号越多分越高)
2. **竞争烈度**(0-100):竞争越激烈分越低
3. **商业化可行性**(0-100):商业化路径是否清晰可行
4. **时机评估**(0-100):进入时机是否合适

---

# 自检 Checklist(输出前检查)

- [ ] 每个结论是否引用了具体的项目名/搜索结果?
- [ ] 市场阶段判定是否与信号矩阵数据一致?
- [ ] 评分是否与"竞争越激烈分越低"的逻辑一致?
- [ ] GitHub 数据权重是否被控制在 15% 以内?

---

# 输出格式

${languageLine(input.language)}
${OUTPUT_RULES}
{
  "agentName": "产业分析员",
  "score": 0,
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于 ${webCount} 条网页和 ${githubCount} 个 GitHub 项目的分析…",
  "analysis": "最终分析结论(2-4段,包含具体项目引用)",
  "dimensionScores": [
    { "name": "市场验证度", "score": 0, "reasoning": "你的真实推理(50字内)" },
    { "name": "竞争烈度", "score": 0, "reasoning": "…" },
    { "name": "商业化可行性", "score": 0, "reasoning": "…" },
    { "name": "时机评估", "score": 0, "reasoning": "…" }
  ],
  "keyFindings": ["发现1(引用具体项目)", "发现2", "发现3"],
  "redFlags": ["风险1"],
  "evidenceSources": ["GitHub: 项目名", "网页: 标题", "网页检索 ${webCount} 条结果"],
  "reasoning": "按 Step1-5 的完整推理过程(放最后,截断安全)"
}`;
}

export const industryAnalystTool: EngineTool<Input, AgentOutput> = {
  id: "agent.industry",
  category: "agent",
  title: { zh: "产业分析员", en: "Industry Analyst" },
  description:
    "基于产业检索数据评估创意的市场格局:市场验证度、竞争烈度、商业化可行性、时机。输入创意 + 产业轨结果。",
  inputSchema,
  async execute(input, ctx) {
    const { text } = await ctx.callAI({
      prompt: buildPrompt(input),
      maxOutputTokens: 16_384,
      timeoutMs: 110_000,
      abortSignal: ctx.abortSignal,
    });
    return normalizeAgentOutput(parseAgentJSON<Partial<AgentOutput>>(text), "产业分析员");
  },
};

registerTool(industryAnalystTool);
