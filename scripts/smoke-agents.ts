// 阶段 5 验收:真子 Agent 跑通第一条管线——双轨检索 → L1(学术/产业/竞品/跨域)
// → L2 创新评估 → L2.5 条件辩论 → L3 仲裁 → L4 质检,产出完整可信报告。
// 需要 .env.local 配置 AI Key(DEEPSEEK_API_KEY 等;ANTHROPIC_* 缺失时 strong 档自动降级国产链)。
// 用法:npx tsx scripts/smoke-agents.ts ["创意"]

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(): void {
  let text = "";
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

async function main(): Promise<void> {
  // 动态导入:确保 .env.local 先于引擎模块求值(模型档位/Key 池读环境变量)
  const { searchDualTrack } = await import("@/core/search");
  const { runPipeline } = await import("@/core/orchestrator");
  await import("@/core/agents");
  await import("@/core/pipeline");

  const query = process.argv[2] ?? "用可降解材料制作的智能温敏药物缓释微胶囊";

  console.log(`① 双轨检索: "${query}"`);
  const t0 = Date.now();
  const dual = await searchDualTrack(query, {
    onProgress: (e, d) => {
      if (e === "log") console.log(`   [检索] ${typeof d === "object" ? JSON.stringify(d) : d}`);
    },
  });
  console.log(
    `   学术 ${dual.academic.results.length} 篇 | 网页 ${dual.industry.webResults.length} 条 | 开源 ${dual.industry.githubRepos.length} 个 | 可信度 ${dual.finalCredibility.score}(${dual.finalCredibility.level})`,
  );

  console.log(`\n② 运行 novoscan-default 管线(真子 Agent)…`);
  const report = await runPipeline({
    pipeline: "novoscan-default",
    input: {
      query,
      academicData: dual.academic,
      industryData: dual.industry,
      language: "zh",
      modelProvider: "deepseek",
      onProgress: (e, d) => {
        if (e === "log" || e === "agent_state") {
          console.log(`   [${e}] ${typeof d === "object" ? JSON.stringify(d) : d}`);
        }
      },
    },
  });

  const mins = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n③ 报告摘要(总耗时 ${mins}s):`);
  const rows: Array<[string, { score: number; confidence: string; isStub?: boolean; isFallback?: boolean }]> = [
    ["学术审查员", report.academicReview],
    ["产业分析员", report.industryAnalysis],
    ["竞品侦探", report.competitorAnalysis],
    ["创新评估师", report.innovationEvaluation],
  ];
  for (const [name, r] of rows) {
    console.log(
      `   ${name}: ${r.score}/100(${r.confidence})${r.isFallback ? " ⚠️ 降级" : ""}${r.isStub ? " ❌ stub" : ""}`,
    );
  }
  if (report.crossDomainTransfer) {
    console.log(
      `   跨域侦察兵: ${report.crossDomainTransfer.score}/100,桥梁 ${report.crossDomainTransfer.bridges.length} 条,领域 [${report.crossDomainTransfer.exploredDomains.slice(0, 5).join("、")}]`,
    );
  }
  console.log(
    `   六维雷达: ${report.innovationEvaluation.innovationRadar?.map((d) => `${d.nameZh}=${d.score}`).join(" ") ?? "缺失"}`,
  );
  console.log(`   辩论: triggered=${report.debate.triggered}(${report.debate.triggerReason})`);
  if (report.debate.triggered) {
    for (const s of report.debate.sessions) {
      console.log(`     - ${s.proAgent} vs ${s.conAgent}: ${s.exchanges.length} 轮 → ${s.verdict.slice(0, 80)}…`);
    }
  }
  console.log(
    `   仲裁: ${report.arbitration.overallScore}/100「${report.arbitration.recommendation}」共识=${report.arbitration.consensusLevel}(模型: ${report.arbitration.usedModel ?? "?"})`,
  );
  console.log(`   摘要: ${report.arbitration.summary.slice(0, 160)}`);
  console.log(
    `   质检: passed=${report.qualityCheck.passed} 一致性=${report.qualityCheck.consistencyScore} issues=${report.qualityCheck.issues.length} warnings=${report.qualityCheck.warnings.length}`,
  );
  if (report.qualityCheck.issues.length) console.log(`     issues: ${report.qualityCheck.issues.join(" | ")}`);

  console.log("\n④ 验收校验:");
  const realAgents = rows.filter(([, r]) => !r.isStub && !r.isFallback);
  const checks: Array<[string, boolean]> = [
    ["至少 3 个核心 Agent 真实完成(非 stub/降级)", realAgents.length >= 3],
    ["各 Agent 评分非同值(独立评估)", new Set(rows.map(([, r]) => r.score)).size > 1],
    ["六维雷达完整且非退化", new Set(report.innovationEvaluation.innovationRadar?.map((d) => d.score) ?? []).size > 1],
    ["仲裁产出决策摘要与建议", report.arbitration.summary.length >= 10 && !!report.arbitration.recommendation],
    ["加权明细透明(权重和≈1)", Math.abs(
      report.arbitration.weightedBreakdown.academic.weight +
        report.arbitration.weightedBreakdown.industry.weight +
        report.arbitration.weightedBreakdown.innovation.weight +
        report.arbitration.weightedBreakdown.competitor.weight -
        1,
    ) < 0.06],
    ["质检结构完整", typeof report.qualityCheck.passed === "boolean" && report.qualityCheck.consistencyScore >= 0],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`   ${pass ? "✅" : "❌"} ${label}`);
    if (!pass) ok = false;
  }
  if (!ok) throw new Error("阶段 5 验收未全部通过");
  console.log("\n🎉 阶段 5 验收通过:真子 Agent 第一条管线端到端跑通,产出完整可信报告。");
}

main().catch((e) => {
  console.error("\n❌ 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
