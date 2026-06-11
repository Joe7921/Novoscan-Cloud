// NovoDebate 辩论引擎(L2.5 条件层):专家分歧大时触发多调用真对抗辩论。
// 参考旧库 debater.ts 重写为 EngineTool。对抗协议:挑战方/防守方/裁判各自独立 AI 调用;
// 信息流编排:反方必须看到正方论点、裁判必须看到双方论点;防循环:最多 3 轮 + 收敛检测 + 超时熔断。
// 模型分工(GIGO 修复):攻防发言=fast 非思考模型(短输出,思考模型会被 reasoning 吃光正文);
// 裁判=本 step 模型(strong,推理质量关键),失败降级为纯逻辑裁判。

import { z } from "zod";
import { callByTier, parseAgentJSON } from "@/core/ai-client";
import type { ToolContext } from "@/core/tools";
import { registerTool, type EngineTool } from "@/core/tools";
import type {
  AgentOutput,
  DebateExchange,
  DebateRecord,
  DebateSession,
  DissentItem,
  Language,
} from "@/lib/types";
import { languageLine, truncate } from "./shared";

// ==================== 常量(沿用旧库经验值) ====================

const DEBATE_SESSION_TIMEOUT = 110_000; // 单场辩论总超时(低于管线 debate step 的 120s)
const SPEECH_TIMEOUT = 25_000; // 攻防单次发言超时
const JUDGE_TIMEOUT = 40_000; // AI 裁判单次超时(strong 思考模型,给足余量)
const DIVERGENCE_THRESHOLD = 15; // 触发阈值:评分差 > 15
const LOW_CONSENSUS_STDDEV = 12; // 标准差低于此值=共识高,跳过
const MAX_ROUNDS = 3;
const ADJUST_PER_ROUND = 5; // 每轮胜负修正幅度
const SCORE_ADJUSTMENT_CAP = MAX_ROUNDS * ADJUST_PER_ROUND;

const agentOutputSchema = z.custom<AgentOutput>((v) => !!v && typeof v === "object");

const inputSchema = z.object({
  query: z.string().describe("用户创意/长文"),
  academic: agentOutputSchema.describe("学术审查员输出"),
  industry: agentOutputSchema.describe("产业分析员输出"),
  innovation: agentOutputSchema.describe("创新评估师输出"),
  competitor: agentOutputSchema.describe("竞品侦探输出"),
  language: z.custom<Language>((v) => v === "zh" || v === "en").describe("输出语言"),
});
type Input = z.infer<typeof inputSchema>;

type Outcome = "challenger_wins" | "defender_wins" | "draw";
interface Speech {
  argument: string;
  evidence: string[];
}
interface Judgment {
  outcome: Outcome;
  isOverwhelming: boolean;
  reasoning: string;
}
interface DebatePair {
  proKey: string;
  conKey: string;
  proAgent: string;
  conAgent: string;
  divergence: number;
  topic: string;
}

// ==================== 触发判断 ====================

function shouldTriggerDebate(agents: Record<string, AgentOutput>): {
  trigger: boolean;
  reason: string;
  pairs: DebatePair[];
} {
  // 降级占位(isFallback)没有真实报告内容,拿去辩论=逼模型编证据(垃圾进),整体排除。
  const keys = ["academic", "industry", "innovation", "competitor"].filter((k) => !agents[k]?.isFallback);
  if (keys.length < 2) {
    return { trigger: false, reason: "真实完成的 Agent 不足 2 个(其余为降级数据),无法辩论", pairs: [] };
  }
  const scores = Object.fromEntries(keys.map((k) => [k, agents[k]?.score ?? 50]));
  const values = keys.map((k) => scores[k]);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);

  if (stdDev <= LOW_CONSENSUS_STDDEV) {
    return { trigger: false, reason: `专家共识度高(标准差 ${Math.round(stdDev)}),无需辩论`, pairs: [] };
  }

  const name = (k: string) => agents[k]?.agentName ?? k;
  // 预设辩论对:学术 vs 竞品、产业 vs 创新(旧库设计)
  const preset: DebatePair[] = [
    {
      proKey: "academic",
      conKey: "competitor",
      proAgent: name("academic"),
      conAgent: name("competitor"),
      divergence: Math.abs(scores.academic - scores.competitor),
      topic: "学术空白 vs 市场已有实现",
    },
    {
      proKey: "industry",
      conKey: "innovation",
      proAgent: name("industry"),
      conAgent: name("innovation"),
      divergence: Math.abs(scores.industry - scores.innovation),
      topic: "市场机会 vs 创新可行性",
    },
  ];
  const triggered = preset.filter(
    (p) => keys.includes(p.proKey) && keys.includes(p.conKey) && p.divergence > DIVERGENCE_THRESHOLD,
  );
  if (triggered.length > 0) {
    return {
      trigger: true,
      reason: `检测到 ${triggered.length} 对专家显著分歧(${triggered.map((p) => `${p.proAgent} vs ${p.conAgent} 差 ${p.divergence} 分`).join(";")}),触发 NovoDebate`,
      pairs: triggered,
    };
  }

  // 动态配对:预设对差异不够但整体分歧大时,挑分歧最大的一对
  let best: DebatePair | null = null;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const div = Math.abs(scores[keys[i]] - scores[keys[j]]);
      if (!best || div > best.divergence) {
        best = {
          proKey: keys[i],
          conKey: keys[j],
          proAgent: name(keys[i]),
          conAgent: name(keys[j]),
          divergence: div,
          topic: `${name(keys[i])} vs ${name(keys[j])} 的结论分歧`,
        };
      }
    }
  }
  if (best && best.divergence > DIVERGENCE_THRESHOLD) {
    return {
      trigger: true,
      reason: `预设辩论对差异不足,动态配对检测到 ${best.proAgent} vs ${best.conAgent} 差 ${best.divergence} 分,触发 NovoDebate`,
      pairs: [best],
    };
  }
  return {
    trigger: false,
    reason: `整体标准差 ${Math.round(stdDev)},但所有 Agent 对的评分差均 ≤ ${DIVERGENCE_THRESHOLD} 分,无需辩论`,
    pairs: [],
  };
}

// ==================== 攻防发言(fast 非思考模型) ====================

async function generateChallenge(
  challenger: AgentOutput,
  defender: AgentOutput,
  query: string,
  language: Language,
  round: number,
  previous: DebateExchange[],
  abortSignal?: AbortSignal,
): Promise<Speech> {
  const prevContext =
    previous.length > 0
      ? `\n## 前几轮辩论记录\n${previous
          .map(
            (e) =>
              `第${e.round}轮:${e.challenger}质疑"${truncate(e.challengerArgument, 100)}",${e.defender}反驳"${truncate(e.defenderRebuttal, 100)}",判定:${e.outcome === "challenger_wins" ? "挑战方胜" : e.outcome === "defender_wins" ? "防守方胜" : "平局"}`,
          )
          .join("\n")}`
      : "";
  const prompt = `
# 角色
你是 ${challenger.agentName},正在一场专家辩论中担任 **挑战方**。

## 你的原始报告
- 评分:${challenger.score}/100(置信度:${challenger.confidence})
- 核心发现:${challenger.keyFindings?.slice(0, 3).join(" | ") || "无"}
- 分析摘要:${truncate(challenger.analysis, 300)}

## 你要质疑的对手:${defender.agentName}
- 评分:${defender.score}/100(置信度:${defender.confidence})
- 核心发现:${defender.keyFindings?.slice(0, 3).join(" | ") || "无"}
- 分析摘要:${truncate(defender.analysis, 300)}

## 被评估的创新点
${query}
${prevContext}

# 任务(第 ${round} 轮,作为挑战方)
基于你的报告数据,对 ${defender.agentName} 的结论提出**有数据支撑**的质疑。
${round > 1 ? "注意:必须提出与之前不同的新论点,不要重复已有质疑。" : ""}
${languageLine(language)}

# 输出格式(JSON)
{ "argument": "对对方结论的质疑(2-3句,引用具体数据)", "evidence": ["证据1", "证据2"] }`;

  try {
    const { text } = await callByTier("fast", {
      prompt,
      maxOutputTokens: 1_024,
      timeoutMs: SPEECH_TIMEOUT,
      abortSignal,
    });
    const parsed = parseAgentJSON<Partial<Speech>>(text);
    return {
      argument: typeof parsed.argument === "string" ? parsed.argument : "",
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String) : [],
    };
  } catch {
    return { argument: `${challenger.agentName}认为对方评分存在偏差(发言生成异常)`, evidence: [] };
  }
}

async function generateRebuttal(
  defender: AgentOutput,
  challenger: AgentOutput,
  challenge: Speech,
  query: string,
  language: Language,
  round: number,
  abortSignal?: AbortSignal,
): Promise<Speech> {
  const prompt = `
# 角色
你是 ${defender.agentName},正在一场专家辩论中担任 **防守方**。

## 你的原始报告
- 评分:${defender.score}/100(置信度:${defender.confidence})
- 核心发现:${defender.keyFindings?.slice(0, 3).join(" | ") || "无"}
- 分析摘要:${truncate(defender.analysis, 300)}

## 被评估的创新点
${query}

## 对方(${challenger.agentName})的质疑(第 ${round} 轮)
**质疑论点**:${challenge.argument}
**引用证据**:${challenge.evidence.join(";") || "无"}

# 任务
针对上述质疑进行**有理有据**的反驳:1) 直接回应对方论点;2) 引用你报告中的数据;3) 对方有道理的部分可以承认,但给出补充解释。
${languageLine(language)}

# 输出格式(JSON)
{ "argument": "对质疑的反驳(2-3句,引用具体数据)", "evidence": ["证据1", "证据2"] }`;

  try {
    const { text } = await callByTier("fast", {
      prompt,
      maxOutputTokens: 1_024,
      timeoutMs: SPEECH_TIMEOUT,
      abortSignal,
    });
    const parsed = parseAgentJSON<Partial<Speech> & { rebuttal?: string }>(text);
    return {
      argument:
        typeof parsed.argument === "string"
          ? parsed.argument
          : typeof parsed.rebuttal === "string"
            ? parsed.rebuttal
            : "",
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String) : [],
    };
  } catch {
    return { argument: `${defender.agentName}坚持原有结论(反驳生成异常)`, evidence: [] };
  }
}

// ==================== 裁判(strong AI 优先,失败降级纯逻辑) ====================

function judgeRoundLogic(
  challengerName: string,
  challenge: Speech,
  defenderName: string,
  rebuttal: Speech,
): Judgment {
  const cEvidence = challenge.evidence.filter((e) => e && e.length > 5).length;
  const dEvidence = rebuttal.evidence.filter((e) => e && e.length > 5).length;
  const cDepth = challenge.argument.length + challenge.evidence.join("").length;
  const dDepth = rebuttal.argument.length + rebuttal.evidence.join("").length;

  if (cEvidence > 0 && dEvidence === 0) {
    return {
      outcome: "challenger_wins",
      isOverwhelming: true,
      reasoning: `${challengerName}提供了 ${cEvidence} 条证据支撑,而${defenderName}未能引用具体证据反驳`,
    };
  }
  if (dEvidence > 0 && cEvidence === 0) {
    return {
      outcome: "defender_wins",
      isOverwhelming: true,
      reasoning: `${defenderName}提供了 ${dEvidence} 条证据有效反驳,而${challengerName}的质疑缺乏证据`,
    };
  }
  if (cEvidence > 0 && dEvidence > 0) {
    const ratio = cDepth / (dDepth + 1);
    if (ratio > 1.4) {
      return { outcome: "challenger_wins", isOverwhelming: false, reasoning: `双方均有证据,但${challengerName}的论证更深入详实` };
    }
    if (ratio < 0.7) {
      return { outcome: "defender_wins", isOverwhelming: false, reasoning: `双方均有证据,但${defenderName}的反驳更全面有力` };
    }
  }
  return { outcome: "draw", isOverwhelming: false, reasoning: "双方论证旗鼓相当,分歧核心在于视角差异而非数据矛盾" };
}

async function judgeRound(
  ctx: ToolContext,
  challengerName: string,
  challenge: Speech,
  defenderName: string,
  rebuttal: Speech,
  round: number,
  language: Language,
): Promise<Judgment> {
  const prompt = `
# 角色
你是一位公正的辩论裁判,需要判定本轮辩论的胜负。

## 第 ${round} 轮辩论记录

### 挑战方:${challengerName}
**质疑论点**:${challenge.argument}
**引用证据**:${challenge.evidence.join(";") || "无"}

### 防守方:${defenderName}
**反驳论点**:${rebuttal.argument}
**引用证据**:${rebuttal.evidence.join(";") || "无"}

# 裁判标准
1. **论点针对性**:防守方是否直接回应了质疑?顾左右而言他扣分
2. **证据质量**:不仅看数量,更看证据是否具体、可验证、直接支撑论点
3. **逻辑严密性**:论证链是否完整,有无逻辑跳跃或循环论证
4. **承认与反驳**:能承认对方合理部分并给出更深层解释的,加分
${languageLine(language)}

# 输出格式(严格 JSON)
{ "outcome": "challenger_wins 或 defender_wins 或 draw", "isOverwhelming": false, "reasoning": "裁判理由(1-2句)" }
isOverwhelming:某方出现致命逻辑断层、被实锤数据秒杀或完全答非所问时为 true。`;

  try {
    const { text } = await ctx.callAI({
      prompt,
      maxOutputTokens: 2_048,
      timeoutMs: JUDGE_TIMEOUT,
      abortSignal: ctx.abortSignal,
    });
    const parsed = parseAgentJSON<{ outcome?: string; isOverwhelming?: boolean; reasoning?: string }>(text);
    if (parsed.outcome !== "challenger_wins" && parsed.outcome !== "defender_wins" && parsed.outcome !== "draw") {
      throw new Error(`AI 裁判返回非法 outcome: ${parsed.outcome}`);
    }
    return {
      outcome: parsed.outcome,
      isOverwhelming: !!parsed.isOverwhelming,
      reasoning: parsed.reasoning || "裁判未给出详细理由",
    };
  } catch (err) {
    ctx.onProgress?.("log", `[NovoDebate] AI 裁判失败(${err instanceof Error ? err.message : String(err)}),降级为逻辑裁判`);
    return judgeRoundLogic(challengerName, challenge, defenderName, rebuttal);
  }
}

// ==================== 收敛检测与评分修正 ====================

function checkConvergence(exchanges: DebateExchange[]): { converged: boolean; reason: string } {
  if (exchanges.length === 0) return { converged: false, reason: "轮次不足" };
  const latest = exchanges[exchanges.length - 1];
  if (latest.isOverwhelming && latest.outcome !== "draw") {
    const winner = latest.outcome === "challenger_wins" ? latest.challenger : latest.defender;
    return { converged: true, reason: `${winner} 取得压倒性优势,触发单轮早停` };
  }
  if (exchanges.length < 2) return { converged: false, reason: "轮次不足且非压倒性" };
  const [a, b] = exchanges.slice(-2);
  if (a.outcome === b.outcome && a.outcome !== "draw") {
    const winner = a.outcome === "challenger_wins" ? a.challenger : a.defender;
    return { converged: true, reason: `${winner} 连续两轮获胜,论证优势明确` };
  }
  if (a.outcome === "draw" && b.outcome === "draw") {
    return { converged: true, reason: "连续两轮平局,分歧已稳定" };
  }
  return { converged: false, reason: "" };
}

function calculateScoreAdjustment(
  exchanges: DebateExchange[],
  proName: string,
): { proAgentDelta: number; conAgentDelta: number } {
  let proDelta = 0;
  for (const e of exchanges) {
    const winner =
      e.outcome === "challenger_wins" ? e.challenger : e.outcome === "defender_wins" ? e.defender : null;
    if (!winner) continue;
    proDelta += winner === proName ? ADJUST_PER_ROUND : -ADJUST_PER_ROUND;
  }
  const capped = Math.max(-SCORE_ADJUSTMENT_CAP, Math.min(SCORE_ADJUSTMENT_CAP, proDelta));
  return { proAgentDelta: capped, conAgentDelta: -capped };
}

function generateVerdict(exchanges: DebateExchange[], proAgent: string, conAgent: string): string {
  if (exchanges.length === 0) return "辩论未能完成。";
  const winsOf = (name: string) =>
    exchanges.filter(
      (e) =>
        (e.outcome === "challenger_wins" && e.challenger === name) ||
        (e.outcome === "defender_wins" && e.defender === name),
    ).length;
  const proWins = winsOf(proAgent);
  const conWins = winsOf(conAgent);
  const draws = exchanges.filter((e) => e.outcome === "draw").length;
  if (proWins > conWins) {
    return `经过 ${exchanges.length} 轮对抗辩论,${proAgent}的论证更具说服力(${proWins}胜${conWins}负${draws}平),建议仲裁员给予其观点更高权重。`;
  }
  if (conWins > proWins) {
    return `经过 ${exchanges.length} 轮对抗辩论,${conAgent}的论证更具说服力(${conWins}胜${proWins}负${draws}平),其反驳有效揭示了对方分析的薄弱环节。`;
  }
  return `经过 ${exchanges.length} 轮对抗辩论,双方旗鼓相当(${proWins}胜${conWins}负${draws}平),核心分歧在于评估视角差异而非数据矛盾。`;
}

// ==================== 单场辩论 ====================

async function runDebateSession(
  ctx: ToolContext,
  pro: AgentOutput,
  con: AgentOutput,
  pair: DebatePair,
  query: string,
  language: Language,
): Promise<DebateSession> {
  const sessionId = `${pro.agentName}_vs_${con.agentName}`.replace(/\s+/g, "_");
  const sessionStart = Date.now();
  const exchanges: DebateExchange[] = [];
  const insights: string[] = [];

  // 评分高的先挑战
  let challenger = pro.score >= con.score ? pro : con;
  let defender = pro.score >= con.score ? con : pro;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (Date.now() - sessionStart > DEBATE_SESSION_TIMEOUT) {
      insights.push(`第 ${round} 轮因场次超时跳过`);
      break;
    }
    ctx.onProgress?.("log", `[NovoDebate] ⚔️ ${sessionId} 第 ${round}/${MAX_ROUNDS} 轮(${challenger.agentName} → ${defender.agentName})`);

    const challenge = await generateChallenge(challenger, defender, query, language, round, exchanges, ctx.abortSignal);
    const defense = await generateRebuttal(defender, challenger, challenge, query, language, round, ctx.abortSignal);
    const judgment = await judgeRound(ctx, challenger.agentName, challenge, defender.agentName, defense, round, language);

    const exchange: DebateExchange = {
      round,
      challenger: challenger.agentName,
      challengerArgument: challenge.argument,
      challengerEvidence: challenge.evidence,
      defender: defender.agentName,
      defenderRebuttal: defense.argument,
      defenderEvidence: defense.evidence,
      outcome: judgment.outcome,
      isOverwhelming: judgment.isOverwhelming,
      outcomeReasoning: judgment.reasoning,
    };
    exchanges.push(exchange);
    ctx.onProgress?.("log", `[NovoDebate] 第 ${round} 轮判定: ${judgment.reasoning}`);

    const convergence = checkConvergence(exchanges);
    if (convergence.converged) {
      insights.push(`辩论在第 ${round} 轮收敛:${convergence.reason}`);
      break;
    }
    [challenger, defender] = [defender, challenger]; // 角色互换
  }

  return {
    sessionId,
    topic: pair.topic,
    proAgent: pro.agentName,
    conAgent: con.agentName,
    scoreDivergence: pair.divergence,
    exchanges,
    verdict: generateVerdict(exchanges, pro.agentName, con.agentName),
    keyInsights: insights,
    scoreAdjustment: calculateScoreAdjustment(exchanges, pro.agentName),
  };
}

// ==================== 分歧报告 ====================

function buildDissentReport(sessions: DebateSession[]): DissentItem[] {
  return sessions.map((s) => {
    const winsOf = (name: string) =>
      s.exchanges.filter(
        (e) =>
          (e.outcome === "challenger_wins" && e.challenger === name) ||
          (e.outcome === "defender_wins" && e.defender === name),
      ).length;
    const proWins = winsOf(s.proAgent);
    const conWins = winsOf(s.conAgent);
    const pickPosition = (name: string) =>
      s.exchanges.map((e) => (e.challenger === name ? e.challengerArgument : e.defenderRebuttal)).find(Boolean) ??
      "未能生成立场";
    return {
      dimension: s.topic,
      proAgent: s.proAgent,
      proPosition: pickPosition(s.proAgent),
      conAgent: s.conAgent,
      conPosition: pickPosition(s.conAgent),
      severity: s.scoreDivergence > 25 ? "high" : s.scoreDivergence > 15 ? "medium" : "low",
      resolution: s.verdict,
      roundsDebated: s.exchanges.length,
      winner: proWins > conWins ? "pro" : conWins > proWins ? "con" : "draw",
    };
  });
}

function formatDissentText(sessions: DebateSession[]): string {
  if (sessions.length === 0) return "辩论未能完成,无分歧报告。";
  const parts: string[] = ["## NovoDebate 分歧报告\n"];
  for (const s of sessions) {
    parts.push(`### 🔥 ${s.proAgent} vs ${s.conAgent}`);
    parts.push(`**辩题**:${s.topic}(评分差异 ${s.scoreDivergence} 分)\n`);
    for (const e of s.exchanges) {
      parts.push(`**第 ${e.round} 轮** ${e.outcome === "challenger_wins" ? "🏆" : e.outcome === "defender_wins" ? "🛡️" : "🤝"} ${e.outcomeReasoning}`);
    }
    parts.push(`\n**裁决**:${s.verdict}`);
    const adj = s.scoreAdjustment;
    if (adj.proAgentDelta !== 0 || adj.conAgentDelta !== 0) {
      parts.push(
        `**评分修正建议**:${s.proAgent} ${adj.proAgentDelta >= 0 ? "+" : ""}${adj.proAgentDelta},${s.conAgent} ${adj.conAgentDelta >= 0 ? "+" : ""}${adj.conAgentDelta}`,
      );
    }
    parts.push("");
  }
  return parts.join("\n");
}

// ==================== EngineTool 封装 ====================

export const debaterTool: EngineTool<Input, DebateRecord> = {
  id: "agent.debate",
  category: "agent",
  title: { zh: "NovoDebate 辩论引擎", en: "NovoDebate Engine" },
  description:
    "专家评分分歧大时执行多轮对抗辩论(挑战/反驳/裁判独立调用),产出结构化分歧报告供仲裁参考。输入创意 + 四份 Agent 输出。",
  inputSchema,
  async execute(input, ctx) {
    const startTime = Date.now();
    const agents: Record<string, AgentOutput> = {
      academic: input.academic,
      industry: input.industry,
      innovation: input.innovation,
      competitor: input.competitor,
    };
    const { trigger, reason, pairs } = shouldTriggerDebate(agents);
    if (!trigger) {
      ctx.onProgress?.("log", `[NovoDebate] 跳过辩论: ${reason}`);
      return {
        triggered: false,
        triggerReason: reason,
        sessions: [],
        totalDurationMs: Date.now() - startTime,
        dissentReport: [],
        dissentReportText: "",
      };
    }

    ctx.onProgress?.("log", `[NovoDebate] 🔥 ${reason}`);
    const settled = await Promise.allSettled(
      pairs.map((pair) =>
        runDebateSession(ctx, agents[pair.proKey], agents[pair.conKey], pair, input.query, input.language),
      ),
    );
    const sessions = settled
      .filter((s): s is PromiseFulfilledResult<DebateSession> => s.status === "fulfilled")
      .map((s) => s.value);

    return {
      triggered: true,
      triggerReason: reason,
      sessions,
      totalDurationMs: Date.now() - startTime,
      dissentReport: buildDissentReport(sessions),
      dissentReportText: formatDissentText(sessions),
    };
  },
};

registerTool(debaterTool);
