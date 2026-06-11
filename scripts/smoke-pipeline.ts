// 结构性验收:用占位 stub Agent 跑通 Novoscan 默认管线整条流程,产出结构完整的报告。
// 不需要任何 API Key(stub 不调模型)。用法:npx tsx scripts/smoke-pipeline.ts
// 阶段 5 起默认管线 step 已指向真子 Agent(toolRef),本脚本把 step 改回同名 stub(agentRef)
// 只验编排与报告结构;真 Agent 验收见 scripts/smoke-agents.ts。

import { runPipeline } from "@/core/orchestrator";
import "@/core/agents"; // 注册 stub Agent + 真 Agent 工具
import { novoscanDefaultPipeline, type PipelineDefinition } from "@/core/pipeline";
import type { AgentInput } from "@/lib/types";

// stub 克隆:step.id 与 stub Agent id 同名,直接以 agentRef 改走旧路径(不调模型)。
const stubPipeline: PipelineDefinition = {
  ...novoscanDefaultPipeline,
  id: "novoscan-default-stub",
  layers: novoscanDefaultPipeline.layers.map((layer) => ({
    ...layer,
    steps: layer.steps.map(({ id, critical, condition, timeoutMs }) => ({
      id,
      agentRef: id,
      critical,
      condition,
      timeoutMs,
    })),
  })),
};

async function main(): Promise<void> {
  const input: AgentInput = {
    query: "示例创意:用 AI 优化城市垃圾分类回收链路",
    academicData: {
      results: [],
      stats: {
        totalPapers: 0,
        totalCitations: 0,
        openAccessCount: 0,
        avgCitation: 0,
        bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 },
        topCategories: [],
      },
      topConcepts: [],
      openAccessCount: 0,
    },
    industryData: {
      webResults: [],
      webSources: { brave: 0, serpapi: 0 },
      githubRepos: [],
      sentiment: "warm",
      hasOpenSource: false,
      topProjects: [],
    },
    language: "zh",
    modelProvider: "deepseek",
    onProgress: (event, data) =>
      console.log(`  [${event}]`, typeof data === "object" ? JSON.stringify(data) : data),
  };

  console.log("① 运行 novoscan-default 管线(stub 克隆,占位 Agent)…");
  const report = await runPipeline({ pipeline: stubPipeline, input });

  console.log("\n② 校验报告结构:");
  const checks: Array<[string, boolean]> = [
    ["academicReview 存在", !!report.academicReview?.agentName],
    ["industryAnalysis 存在", !!report.industryAnalysis?.agentName],
    ["competitorAnalysis 存在", !!report.competitorAnalysis?.agentName],
    ["crossDomainTransfer 存在", !!report.crossDomainTransfer],
    ["innovationRadar 为 6 维", report.innovationEvaluation.innovationRadar?.length === 6],
    ["debate 字段存在", typeof report.debate?.triggered === "boolean"],
    ["arbitration.weightedBreakdown 完整", !!report.arbitration?.weightedBreakdown?.academic],
    ["qualityCheck 存在", typeof report.qualityCheck?.passed === "boolean"],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`   ${pass ? "✅" : "❌"} ${label}`);
    if (!pass) ok = false;
  }

  console.log(
    `\n   辩论触发=${report.debate.triggered}(stub 评分无分歧,应为 false),` +
      `仲裁总分=${report.arbitration.overallScore},质检通过=${report.qualityCheck.passed}`,
  );

  if (!ok) throw new Error("报告结构校验未通过");
  console.log("\n🎉 验收②通过:空管线端到端跑通,报告结构完整。");
}

main().catch((e) => {
  console.error("\n❌ 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
