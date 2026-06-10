// 阶段4-B 验收:双轨检索(学术 + 产业)→ 交叉验证 → 可信度评分。
// 学术免费源 + GitHub 匿名可真跑;产业网页源无 key 自动跳过(届时 industrySupport 偏弱,
// 正好展示交叉验证的"学术强/产业弱"风险标记)。
// 用法:npx tsx scripts/smoke-dual.ts ["创意"]

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { searchDualTrack } from "@/core/search";

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
  const query = process.argv[2] ?? "用人工智能优化城市垃圾分类回收";
  console.log(`① 双轨检索: "${query}"\n`);

  const r = await searchDualTrack(query, {
    onProgress: (e, d) => console.log(`  [${e}]`, typeof d === "object" ? JSON.stringify(d) : d),
  });

  console.log(
    `\n② 学术 ${r.academic.results.length} 篇 | 产业网页 ${r.industry.webResults.length} 条 | 开源 ${r.industry.githubRepos.length} 个`,
  );
  console.log(
    `   交叉验证:学术支撑=${r.crossValidation.academicSupport} 产业支撑=${r.crossValidation.industrySupport} 共识=${r.crossValidation.consistencyScore}`,
  );
  console.log(`   风险标记:`, r.crossValidation.redFlags.length ? r.crossValidation.redFlags.join("; ") : "(无)");
  console.log(`   洞察:`, r.crossValidation.insights.join("; ") || "(无)");
  console.log(`   可信度:${r.finalCredibility.score} (${r.finalCredibility.level})`);
  console.log(`   建议:${r.recommendation}`);
  console.log(`   耗时:${r.searchTimeMs}ms`);
  if (r.industry.githubRepos.length) {
    console.log(
      `\n   开源样例:`,
      r.industry.githubRepos.slice(0, 3).map((g) => `${g.fullName}(★${g.stars})`).join(", "),
    );
  }

  console.log("\n🎉 阶段4-B 验收:双轨检索 + 交叉验证 + 可信度评分 跑通。");
}

main().catch((e) => {
  console.error("\n❌ 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
