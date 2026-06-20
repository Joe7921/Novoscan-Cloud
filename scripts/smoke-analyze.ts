// 阶段 6 验收:直调 runAnalysis(不经 HTTP)验证流式事件 + 缓存命中 + 记忆沉淀。
// 需要 .env.local 配置 AI Key 与 Supabase(DATABASE/secret),真实跑一次有成本。
// 用法:npx tsx scripts/smoke-analyze.ts ["创意"]
// 提示:本机 shell 预置的 ANTHROPIC_* 会覆盖 .env.local,跑前清除:
//   env -u ANTHROPIC_BASE_URL -u ANTHROPIC_MODEL -u ANTHROPIC_API_KEY npx tsx scripts/smoke-analyze.ts

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
  const { runAnalysis } = await import("@/lib/analyze/run-analysis");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { queryHash } = await import("@/lib/utils/query-hash");
  type Ev = import("@/lib/analyze/types").AnalyzeStreamEvent;

  const query = process.argv[2] ?? "用可降解材料制作的智能温敏药物缓释微胶囊";

  // 直查 agent_memory:确认沉淀真写进库(而非靠脚本脑补)。
  async function fetchMemoryRow(): Promise<{ final_score: number; recommendation: string } | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("agent_memory")
      .select("final_score, recommendation")
      .eq("query_hash", queryHash(query))
      .maybeSingle();
    if (error) throw error;
    return (data as { final_score: number; recommendation: string } | null) ?? null;
  }

  // 一次运行:收集事件 + 打印关键节点
  const run = async (label: string, refresh: boolean) => {
    console.log(`\n=== ${label} ===`);
    const events: Ev[] = [];
    const t0 = Date.now();
    await runAnalysis({ query, language: "zh", refresh }, (e) => {
      events.push(e);
      if (e.type === "phase") console.log(`  · 阶段[${e.phase}] ${e.message}`);
      else if (e.type === "search")
        console.log(`  · 检索:可信度 ${e.credibility}(${e.level})| 学术 ${e.academic} 网页 ${e.web} 开源 ${e.github}`);
      else if (e.type === "memory") console.log(`  · 记忆:召回 ${e.experiencesUsed} 条`);
      else if (e.type === "agent_state") console.log(`  · [${e.agentId}] ${e.status}`);
      else if (e.type === "report")
        console.log(
          `  · 报告:${e.report.arbitration.overallScore}/100「${e.report.arbitration.recommendation}」fromCache=${e.fromCache} 耗时 ${(e.elapsedMs / 1000).toFixed(0)}s`,
        );
      else if (e.type === "error") console.log(`  · ❌ error: ${e.message}`);
    });
    console.log(`  (${label} 总耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s,共 ${events.length} 条事件)`);
    return events;
  };

  const first = await run("首次分析(应跑完整管线)", false);
  // 首次跑完后直查库,确认记忆真沉淀(沉淀是 best-effort,失败不报错,只能靠查库验证)。
  const memoryRow = await fetchMemoryRow();
  console.log(
    memoryRow
      ? `  · 记忆已入库:final_score=${memoryRow.final_score}「${memoryRow.recommendation}」`
      : `  · ⚠️ 记忆表未找到该 query 的行`,
  );
  const second = await run("二次分析(应命中缓存)", false);

  // 验收校验
  console.log("\n验收校验:");
  const firstReport = first.find((e): e is Extract<Ev, { type: "report" }> => e.type === "report");
  const secondReport = second.find((e): e is Extract<Ev, { type: "report" }> => e.type === "report");
  const checks: Array<[string, boolean]> = [
    ["首次事件流含 search/agent_state/report/done", ["search", "agent_state", "report", "done"].every((t) => first.some((e) => e.type === t))],
    ["首次拿到完整报告(非缓存)", !!firstReport && firstReport.fromCache === false],
    ["首次报告含仲裁结论", !!firstReport && firstReport.report.arbitration.summary.length >= 10],
    ["记忆已真正写入库(直查 agent_memory 命中)", !!memoryRow],
    ["入库分数与报告一致", !!memoryRow && !!firstReport && memoryRow.final_score === firstReport.report.arbitration.overallScore],
    ["二次命中缓存(fromCache=true)", !!secondReport && secondReport.fromCache === true],
  ];
  // 参考信息(不作硬断言:DB 抖动可能让"更快"偶发不成立,fromCache 才是强判据)
  if (firstReport && secondReport) {
    console.log(
      `  (参考)首次 ${(firstReport.elapsedMs / 1000).toFixed(0)}s vs 缓存命中 ${(secondReport.elapsedMs / 1000).toFixed(1)}s`,
    );
  }
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✅" : "❌"} ${label}`);
    if (!pass) ok = false;
  }
  if (!ok) throw new Error("阶段 6 验收未全部通过");
  console.log("\n🎉 阶段 6 验收通过:analyze 流式接口 + 缓存读写 + 记忆沉淀端到端跑通。");
}

main().catch((e) => {
  console.error("\n❌ 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
