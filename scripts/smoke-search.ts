// 阶段4 学术轨验收:真打免费学术源(OpenAlex/arXiv/CrossRef,无需 key)返回真实论文,
// 经证据闸门(相关性重排过滤)+ 聚合统计。
// 用法:npx tsx scripts/smoke-search.ts ["你的创意"]
// 有国产 key 时证据闸门走 LLM 重排;无 key 走规则重排(仍可验收)。

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { searchAcademic } from "@/core/search";

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
  console.log(`① 学术检索: "${query}"\n`);

  const result = await searchAcademic(query, {
    perSourceLimit: 8,
    topK: 15,
    onProgress: (e, d) => console.log(`  [${e}]`, typeof d === "object" ? JSON.stringify(d) : d),
  });

  console.log(`\n② 结果:${result.results.length} 篇高相关论文`);
  console.log(`   按源:`, JSON.stringify(result.stats.bySource));
  console.log(`   总引用=${result.stats.totalCitations}  开放获取=${result.openAccessCount}  平均引用=${result.stats.avgCitation}`);
  console.log(`   高频概念:`, result.topConcepts.slice(0, 5).join(" / ") || "(无)");
  console.log(`\n   样例(前 3 篇):`);
  for (const p of result.results.slice(0, 3)) {
    console.log(`   - [${p.year ?? "?"}] ${p.title ?? "(无题)"} (引用 ${p.citationCount ?? 0})`);
  }

  if (result.results.length === 0) {
    throw new Error("未返回任何论文(可能外网不可达或关键词过窄)");
  }
  console.log("\n🎉 阶段4 学术轨验收通过:免费源真实返回 + 证据闸门 + 聚合统计。");
}

main().catch((e) => {
  console.error("\n❌ 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
