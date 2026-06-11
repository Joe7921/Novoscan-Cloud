// 跨域侦察兵(L1 后台非关键):提取创意底层原理,在远源领域寻找类似原理与迁移路径。
// 参考旧库 crossDomainScout.ts 重写为 EngineTool;NovoDNA 基因池联动属旧库特有服务,待记忆层(阶段 6)后评估是否重建。

import { z } from "zod";
import type {
  AcademicResult,
  CrossDomainBridge,
  CrossDomainScoutOutput,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  IndustryResult,
  Language,
} from "@/lib/types";
import { parseAgentJSON } from "@/core/ai-client";
import { registerTool, type EngineTool } from "@/core/tools";
import { domainBlock, languageLine, normalizeAgentOutput, clampScore } from "./shared";

const inputSchema = z.object({
  query: z.string().describe("用户创意/长文"),
  academicData: z.custom<AcademicResult>((v) => !!v && typeof v === "object").describe("学术轨聚合检索结果"),
  industryData: z.custom<IndustryResult>((v) => !!v && typeof v === "object").describe("产业轨聚合检索结果"),
  language: z.custom<Language>((v) => v === "zh" || v === "en").describe("输出语言"),
  domainHint: z.string().optional().describe("用户所在领域"),
});
type Input = z.infer<typeof inputSchema>;

function buildPrompt(input: Input): string {
  const paperTopics = input.academicData.topConcepts?.slice(0, 5).join(", ") || "unknown";
  const topPapers =
    input.academicData.results
      ?.slice(0, 3)
      .map((p) => p.title)
      .filter(Boolean)
      .join("; ") || "none";
  const industrySignal = input.industryData.sentiment ?? "unknown";

  return `
# 系统角色

你是一位拥有 20 年跨学科创新咨询经验的"跨域侦察兵",曾帮助 NASA、IDEO、MIT Media Lab 等机构发现跨领域灵感。
你精通以下领域的底层原理映射:生物仿生学、航空航天工程、材料科学与纳米技术、游戏设计与交互技术、金融工程、建筑与城市规划、军事与国防技术、农业与食品科技、量子计算与信息论、艺术与认知科学。

你的核心信念:**最伟大的创新往往来自把 A 领域的方法搬到 B 领域。**

## 专业边界
- 你专注于发现跨领域的技术原理共通性,不评价具体领域内的学术深度
- 你的联想必须有科学依据,不能天马行空地编造
- 每一条跨域桥梁都必须说明底层原理的共通性

---

# 任务

分析用户的创新点,提取其**底层技术原理**,然后在至少 5 个**完全不同的领域**中寻找使用了类似原理或方法的案例,生成跨域迁移建议。

**用户创新点**:${input.query}
${domainBlock(input.domainHint)}
**检索上下文**:
- 相关学术关键词:${paperTopics}
- 代表性论文:${topPapers}
- 市场热度信号:${industrySignal}

---

# 思维链(请按以下步骤逐步推理)

**Step 1 - 底层原理提取(最关键)**:从用户创意中剥离表面应用,提取 2-3 个核心底层技术原理
**Step 2 - 远源领域联想**:针对每个底层原理,联想至少 5 个**完全不同**的领域("完全不同"=跨越至少 2 个学科大类)
**Step 3 - 具体案例匹配**:在每个远源领域找 1-2 个具体案例(最好是知名论文、专利或产品)
**Step 4 - 迁移可行性评估**:评估每条桥梁的迁移创新潜力(0-100)、可行性、风险等级
**Step 5 - 知识图谱构建**:把用户创意、底层原理、远源案例组织成节点-边关系

---

# 评分标准

## 综合评分(0-100)— 跨域迁移潜力:
| 区间 | 含义 |
|------|------|
| 81-100 | 发现了极其惊人的跨域联系,多条高价值迁移路径 |
| 61-80 | 发现了有价值的跨域联系,至少 2 条高潜力桥梁 |
| 41-60 | 有一些跨域联系但迁移价值中等 |
| 21-40 | 跨域联系较弱,原理共通性有限 |
| 0-20 | 几乎无法找到有意义的跨域联系 |

## 4 个评分维度:
1. **原理共通性**(0-100) 2. **迁移创新潜力**(0-100) 3. **领域跨度**(0-100,越远越高) 4. **案例可信度**(0-100)

---

# 输出格式

${languageLine(input.language)}
严格按以下 JSON 格式输出,不要有任何其他内容(score 必须是数字类型,必须基于真实推理,严禁照抄示例数值):
{
  "agentName": "跨域侦察兵",
  "score": 0,
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于 X 个领域的交叉分析…",
  "analysis": "跨域迁移分析总结(2-3段,包含具体案例引用)",
  "dimensionScores": [
    { "name": "原理共通性", "score": 0, "reasoning": "…" },
    { "name": "迁移创新潜力", "score": 0, "reasoning": "…" },
    { "name": "领域跨度", "score": 0, "reasoning": "…" },
    { "name": "案例可信度", "score": 0, "reasoning": "…" }
  ],
  "keyFindings": ["发现1", "发现2", "发现3"],
  "redFlags": ["风险提示"],
  "evidenceSources": ["Nature 2024 - 论文标题", "专利 US1234567"],
  "transferSummary": "一段精华总结,告诉用户最有价值的跨域灵感是什么",
  "exploredDomains": ["领域1", "领域2", "领域3", "领域4", "领域5"],
  "bridges": [
    {
      "sourceField": "用户所在领域",
      "targetField": "远源领域名",
      "techPrinciple": "共通的底层技术原理",
      "sourceExample": "用户领域的应用案例",
      "targetExample": "远源领域的具体案例(含年份和出处)",
      "reference": "参考文献(如有)",
      "transferPath": "从A到B的具体迁移路径描述",
      "noveltyPotential": 0,
      "feasibility": "high 或 medium 或 low",
      "riskLevel": "low 或 medium 或 high"
    }
  ],
  "knowledgeGraph": {
    "nodes": [
      { "id": "user_innovation", "label": "用户创新点简称", "field": "用户领域", "type": "application" },
      { "id": "principle_1", "label": "底层原理名", "field": "通用", "type": "principle" },
      { "id": "case_1", "label": "远源案例名", "field": "远源领域", "type": "technology" }
    ],
    "edges": [
      { "source": "user_innovation", "target": "principle_1", "relation": "same_principle", "strength": 0.9 },
      { "source": "principle_1", "target": "case_1", "relation": "inspires", "strength": 0.7 }
    ]
  },
  "reasoning": "按 Step1-5 的完整推理过程(放最后,截断安全)"
}

⚠️ 重要要求:
- bridges 至少 3 条、最多 6 条;knowledgeGraph 至少 5 节点 4 边;exploredDomains 至少 5 个领域
- 所有案例引用必须尽可能真实(如 Nature 论文、知名专利、著名产品)
- transferPath 必须是具体可执行的迁移描述,不能是空洞的"可以结合"`;
}

const FEASIBILITY = ["high", "medium", "low"] as const;
const RISK = ["low", "medium", "high"] as const;
const NODE_TYPES = ["technology", "application", "principle"] as const;
const RELATIONS = ["same_principle", "analogous", "evolved_from", "inspires"] as const;

function normalizeBridges(value: unknown): CrossDomainBridge[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (b): b is Record<string, unknown> =>
        !!b && typeof b === "object" && !!b.sourceField && !!b.targetField && !!b.techPrinciple,
    )
    .slice(0, 6)
    .map((b) => ({
      sourceField: String(b.sourceField),
      targetField: String(b.targetField),
      techPrinciple: String(b.techPrinciple),
      sourceExample: String(b.sourceExample ?? ""),
      targetExample: String(b.targetExample ?? ""),
      reference: b.reference ? String(b.reference) : undefined,
      transferPath: String(b.transferPath ?? ""),
      noveltyPotential: clampScore(b.noveltyPotential),
      feasibility: FEASIBILITY.includes(b.feasibility as (typeof FEASIBILITY)[number])
        ? (b.feasibility as (typeof FEASIBILITY)[number])
        : "medium",
      riskLevel: RISK.includes(b.riskLevel as (typeof RISK)[number])
        ? (b.riskLevel as (typeof RISK)[number])
        : "medium",
    }));
}

function normalizeGraph(value: unknown): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  if (!value || typeof value !== "object") return { nodes: [], edges: [] };
  const g = value as Record<string, unknown>;
  const nodes: KnowledgeGraphNode[] = Array.isArray(g.nodes)
    ? g.nodes
        .filter((n): n is Record<string, unknown> => !!n && typeof n === "object" && !!n.id && !!n.label)
        .slice(0, 20)
        .map((n) => ({
          id: String(n.id),
          label: String(n.label),
          field: String(n.field ?? "未知"),
          type: NODE_TYPES.includes(n.type as (typeof NODE_TYPES)[number])
            ? (n.type as (typeof NODE_TYPES)[number])
            : "technology",
        }))
    : [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: KnowledgeGraphEdge[] = Array.isArray(g.edges)
    ? g.edges
        .filter(
          (e): e is Record<string, unknown> =>
            !!e && typeof e === "object" && nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)),
        )
        .slice(0, 30)
        .map((e) => ({
          source: String(e.source),
          target: String(e.target),
          relation: RELATIONS.includes(e.relation as (typeof RELATIONS)[number])
            ? (e.relation as (typeof RELATIONS)[number])
            : "analogous",
          strength: typeof e.strength === "number" ? Math.max(0, Math.min(1, e.strength)) : 0.5,
        }))
    : [];
  return { nodes, edges };
}

export const crossDomainScoutTool: EngineTool<Input, CrossDomainScoutOutput> = {
  id: "agent.crossDomain",
  category: "agent",
  title: { zh: "跨域侦察兵", en: "Cross-Domain Scout" },
  description:
    "提取创意底层技术原理,在 5+ 个远源领域寻找类似原理案例,产出跨域迁移桥梁与知识图谱。输入创意 + 双轨检索结果。",
  inputSchema,
  async execute(input, ctx) {
    const { text } = await ctx.callAI({
      prompt: buildPrompt(input),
      maxOutputTokens: 16_384,
      timeoutMs: 180_000, // 桥梁+知识图谱输出大,推理极长;慢非瞬障,单次长跑优于多次重试
      priority: "low", // 后台非关键路径,让出并发额度给关键 Agent
      abortSignal: ctx.abortSignal,
    });
    const raw = parseAgentJSON<Record<string, unknown>>(text);
    const base = normalizeAgentOutput(raw as Partial<CrossDomainScoutOutput>, "跨域侦察兵");
    return {
      ...base,
      bridges: normalizeBridges(raw.bridges),
      knowledgeGraph: normalizeGraph(raw.knowledgeGraph),
      exploredDomains: Array.isArray(raw.exploredDomains)
        ? raw.exploredDomains.filter((d): d is string => typeof d === "string").slice(0, 10)
        : [],
      transferSummary: typeof raw.transferSummary === "string" ? raw.transferSummary : base.analysis,
    };
  },
};

registerTool(crossDomainScoutTool);
