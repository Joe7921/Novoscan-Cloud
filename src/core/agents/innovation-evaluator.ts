// 创新评估师(L2 独占层):综合 L1 三份报告交叉质疑,产出六维创新雷达。
// 参考旧库 innovationEvaluator.ts 重写为 EngineTool;保留交叉审查角色、六维框架、防示例复制重试。

import { z } from "zod";
import type { AgentOutput, InnovationRadarDimension, Language } from "@/lib/types";
import { parseAgentJSON } from "@/core/ai-client";
import { registerTool, type EngineTool } from "@/core/tools";
import {
  OUTPUT_RULES,
  domainBlock,
  languageLine,
  memoryBlock,
  normalizeAgentOutput,
  truncate,
  truncateList,
  clampScore,
} from "./shared";

const agentOutputSchema = z.custom<AgentOutput>((v) => !!v && typeof v === "object");

const inputSchema = z.object({
  query: z.string().describe("用户创意/长文"),
  academic: agentOutputSchema.describe("学术审查员输出"),
  industry: agentOutputSchema.describe("产业分析员输出"),
  competitor: agentOutputSchema.describe("竞品侦探输出"),
  language: z.custom<Language>((v) => v === "zh" || v === "en").describe("输出语言"),
  domainHint: z.string().optional().describe("用户指定的学科领域"),
  memoryContext: z.string().optional().describe("记忆层 RAG 注入的历史经验"),
});
type Input = z.infer<typeof inputSchema>;

const RADAR_KEYS = [
  "techBreakthrough",
  "businessModel",
  "userExperience",
  "orgCapability",
  "networkEcosystem",
  "socialImpact",
] as const;

function upstreamBlock(label: string, out: AgentOutput): string {
  return `## 上游报告 ${label}:${out.agentName}
- **评分**:${out.score}/100(置信度:${out.confidence}${out.isFallback ? ",⚠️ 降级数据" : ""})
- **核心发现**:${truncateList(out.keyFindings, 5, 100)}
- **风险提示**:${truncateList(out.redFlags, 5, 100)}
- **详细分析**:${truncate(out.analysis, 600)}`;
}

function buildPrompt(input: Input): string {
  const scores = {
    academic: input.academic.score ?? 50,
    industry: input.industry.score ?? 50,
    competitor: input.competitor.score ?? 50,
  };
  const maxDiff =
    Math.max(scores.academic, scores.industry, scores.competitor) -
    Math.min(scores.academic, scores.industry, scores.competitor);
  const avgScore = Math.round((scores.academic + scores.industry + scores.competitor) / 3);

  return `
# 系统角色

你是一位著名的技术创新评估专家,曾参与多个独角兽项目(如 Stripe、Notion、Figma)的早期技术评估。
你的核心能力是:**综合多方专家意见,识别矛盾点,做出独立的创新性判断**。

## 核心职责——交叉审查
你不仅要做创新评估,更要扮演"质疑者"的角色:
- 挑战上游三位专家报告中的矛盾和漏洞
- 识别各专家可能的认知偏差
- 做出独立于三位专家的、有理有据的判断

## 专业边界
- 你综合学术、产业、竞品三个维度做创新评估
- 你必须引用上游报告的具体结论,不能凭空分析
- ⚠️ **核心纠偏**:缺乏 GitHub 开源项目,**绝对不等于**产业应用空白或学术空白。很多深水区技术是企业核心机密,本就不会开源。若某位上游专家仅因"没有开源项目"就认定"蓝海"或"技术空白",你必须作为质疑者**严厉反驳**这一逻辑漏洞,并基于真实商业逻辑重新评估。

---

# 任务

综合以下三份专家报告,对用户创新点做出独立的创新性评估:

**用户创新点**:${input.query}
${domainBlock(input.domainHint, "\n交叉质疑时考虑该领域特殊性(如医学的审批壁垒、工学的工程可行性);上游忽略领域特异性的结论应在你的裁决中纠偏。")}${memoryBlock(input.memoryContext)}
---

${upstreamBlock("A", input.academic)}

${upstreamBlock("B", input.industry)}

${upstreamBlock("C", input.competitor)}

---

## ⚠️ 评分差异预警

三位专家评分:学术 ${scores.academic} / 产业 ${scores.industry} / 竞品 ${scores.competitor}
平均分:${avgScore},最大差异:${maxDiff} 分
${maxDiff > 20 ? "**警告:专家评分差异超过 20 分,请重点分析分歧原因!**" : "评分差异在正常范围内。"}

---

# 思维链(请按以下步骤逐步推理)

**Step 1 - 交叉验证**:三位专家的一致点与矛盾点;各置信度是否可靠
**Step 2 - 矛盾裁决**:对每个矛盾点给出你的判断与理由,指出哪位专家可能有偏差
**Step 3 - 创新分类**:颠覆式 / 平台式 / 渐进式 / 应用式
**Step 4 - 可行性评估**:技术 / 市场 / 执行三个层面
**Step 5 - 护城河评估**:技术壁垒、网络效应、数据壁垒、品牌壁垒
**Step 6 - NovoStarchart 六维创新性评估**(基于德布林十型创新、IDEO DVF、Henderson-Clark 分类法与 ESG 标准,六个维度独立打分 0-100):
1. **技术突破与性能跨越(techBreakthrough)**:功能独特性、技术含量、性能提升幅度;1=完全模仿,100=全球首创且专利壁垒极高
2. **商业模式与获利逻辑(businessModel)**:获利逻辑是否打破行业常规(买断→SaaS 等);1=完全传统定价,100=颠覆行业获利规则
3. **用户期望与交互体验(userExperience)**:是否解决真实的未被满足的痛点;1=用户无感/已有完善替代,100=开创全新体验范式
4. **组织能力与流程效能(orgCapability)**:概念到落地的执行路径是否清晰(TRL/IRL);1=研发周期极长且路径模糊,100=可快速迭代
5. **网络协同与生态效应(networkEcosystem)**:能否构建平台/生态、锁入效应;1=完全孤立单品,100=强生态高锁入
6. **社会贡献与环境可持续(socialImpact)**:资源/碳排降低、SROI、包容性;1=无益或有害,100=引领行业 ESG 标准

---

# 评分标准(Rubric)

## 综合评分(0-100)含义:
| 区间 | 含义 |
|------|------|
| 81-100 | 颠覆式创新,高壁垒,时机完美 |
| 61-80 | 高创新性,有明确壁垒,值得推进 |
| 41-60 | 中等创新,有一定可行性但壁垒不高 |
| 21-40 | 渐进式改进,壁垒弱,竞争优势不明显 |
| 0-20 | 创新性极低或完全不可行 |

## 4 个评分维度:
1. **原创性**(0-100):综合学术空白 + 竞品差异
2. **技术壁垒**(0-100):能否建立有效护城河
3. **市场时机**(0-100):综合产业阶段 + 趋势
4. **执行可行性**(0-100):技术和商业上是否可落地

---

# 自检 Checklist(输出前检查)

- [ ] 是否明确指出了三位专家之间的矛盾点?每个裁决是否有独立理由?
- [ ] 创新分类是否有数据支撑(而非直觉)?
- [ ] 评分是否反映交叉验证后的综合判断,而非简单平均?
- [ ] 六维评分是否每个维度都有独立理由?若六维分数趋同,说明分析不够深入

---

# 输出格式

${languageLine(input.language)}
${OUTPUT_RULES}
{
  "agentName": "创新评估师",
  "score": 0,
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "你的置信度理由…",
  "analysis": "最终分析结论(含矛盾裁决、创新分类、护城河评估)",
  "innovationRadar": [
    { "key": "techBreakthrough", "nameZh": "技术突破与性能跨越", "nameEn": "Technical Breakthrough", "score": 0, "reasoning": "…" },
    { "key": "businessModel", "nameZh": "商业模式与获利逻辑", "nameEn": "Business Model", "score": 0, "reasoning": "…" },
    { "key": "userExperience", "nameZh": "用户期望与交互体验", "nameEn": "User Experience", "score": 0, "reasoning": "…" },
    { "key": "orgCapability", "nameZh": "组织能力与流程效能", "nameEn": "Org Capability", "score": 0, "reasoning": "…" },
    { "key": "networkEcosystem", "nameZh": "网络协同与生态效应", "nameEn": "Network & Ecosystem", "score": 0, "reasoning": "…" },
    { "key": "socialImpact", "nameZh": "社会贡献与环境可持续", "nameEn": "Social Impact", "score": 0, "reasoning": "…" }
  ],
  "dimensionScores": [
    { "name": "原创性", "score": 0, "reasoning": "…" },
    { "name": "技术壁垒", "score": 0, "reasoning": "…" },
    { "name": "市场时机", "score": 0, "reasoning": "…" },
    { "name": "执行可行性", "score": 0, "reasoning": "…" }
  ],
  "keyFindings": ["交叉验证发现1", "矛盾裁决结论", "创新分类结论"],
  "redFlags": ["风险1"],
  "evidenceSources": ["学术审查员报告: …", "产业分析员报告: …", "竞品侦探报告: …"],
  "reasoning": "按 Step1-6 的完整推理过程(放最后,截断安全)"
}`;
}

/** 六维雷达归一化:按固定 key 补齐缺失维度。 */
function normalizeRadar(value: unknown): InnovationRadarDimension[] {
  const list = Array.isArray(value)
    ? value.filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    : [];
  return RADAR_KEYS.map((key) => {
    const found = list.find((d) => d.key === key);
    return {
      key,
      nameZh: typeof found?.nameZh === "string" ? found.nameZh : key,
      nameEn: typeof found?.nameEn === "string" ? found.nameEn : key,
      score: clampScore(found?.score),
      reasoning: typeof found?.reasoning === "string" ? found.reasoning : "",
    };
  });
}

/** 检测六维分数是否退化(全部相同 → 模型没有独立评估,需重试)。 */
function isDegenerateRadar(radar: InnovationRadarDimension[]): boolean {
  return radar.length === 6 && new Set(radar.map((d) => d.score)).size === 1;
}

export const innovationEvaluatorTool: EngineTool<Input, AgentOutput> = {
  id: "agent.innovation",
  category: "agent",
  title: { zh: "创新评估师", en: "Innovation Evaluator" },
  description:
    "综合学术/产业/竞品三份上游报告交叉质疑,做独立创新性评估并产出六维创新雷达。输入创意 + 三份 L1 Agent 输出。",
  inputSchema,
  async execute(input, ctx) {
    // temperature 提高输出多样性(旧库经验:防止模型照抄示例分数)
    const { text } = await ctx.callAI({
      prompt: buildPrompt(input),
      maxOutputTokens: 16_384,
      timeoutMs: 110_000,
      temperature: 0.85,
      abortSignal: ctx.abortSignal,
    });
    const raw = parseAgentJSON<Record<string, unknown>>(text);
    const out = normalizeAgentOutput(raw as Partial<AgentOutput>, "创新评估师");
    out.innovationRadar = normalizeRadar(raw.innovationRadar);

    // 防退化重试:六维分数全相同说明没有独立评估,强制重打一次
    if (isDegenerateRadar(out.innovationRadar)) {
      ctx.onProgress?.("log", "[创新评估师] 六维分数退化(全部相同),触发重试");
      try {
        const retryPrompt = `你刚才输出的 innovationRadar 六维评分全部相同,这是无效的。
请针对创意「${input.query}」重新独立评估六个维度(techBreakthrough/businessModel/userExperience/orgCapability/networkEcosystem/socialImpact),要求:
1. 每个维度根据创意实际特征独立打分(0-100),分数间应有合理差异(标准差至少 10 分)
2. 分数需与上游专家评分逻辑一致:学术 ${input.academic.score} / 产业 ${input.industry.score} / 竞品 ${input.competitor.score}
3. 每个维度至少 20 字 reasoning
${languageLine(input.language)}
直接输出 {"innovationRadar":[…6 项…]} 的 JSON,不要有其他内容。`;
        const retry = await ctx.callAI({
          prompt: retryPrompt,
          maxOutputTokens: 4_096,
          timeoutMs: 40_000,
          temperature: 0.95,
          abortSignal: ctx.abortSignal,
        });
        const retryRadar = normalizeRadar(parseAgentJSON<Record<string, unknown>>(retry.text).innovationRadar);
        if (!isDegenerateRadar(retryRadar)) out.innovationRadar = retryRadar;
      } catch {
        // 重试失败保留原始结果(已有 log)
      }
    }
    return out;
  },
};

registerTool(innovationEvaluatorTool);
