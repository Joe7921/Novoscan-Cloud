// 阶段 2 建表 + 读写验证脚本。
// 用法:在项目根目录运行  node scripts/db-setup.mjs
// 前置:.env.local 已填 DATABASE_URL(Supabase 数据库直连串,含密码)。
//
// 脚本做三件事:
//   1. 执行 migration SQL(建表/索引/触发器/RLS),幂等可重复跑。
//   2. 往两张表各写入一条体检数据并读回,验证可读写。
//   3. 清理体检数据。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// --- 读取 .env.local 的 DATABASE_URL ---
function loadEnv() {
  let text = "";
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    throw new Error("未找到 .env.local,请先复制 .env.example 并填入 DATABASE_URL");
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error(".env.local 中未配置 DATABASE_URL");
}

const connStr = loadEnv();
const migrationPath = join(root, "supabase", "migrations", "0001_stage2_data_foundation.sql");
const migrationSql = readFileSync(migrationPath, "utf8");

const sql = postgres(connStr, { onnotice: () => {} });

async function main() {
  console.log("① 执行 migration(建表/索引/触发器/RLS)…");
  await sql.unsafe(migrationSql);
  console.log("   ✅ migration 执行完成");

  console.log("② 验证 search_history 可读写…");
  const hcQuery = "__healthcheck__";
  const hcResult = { ok: true, note: "stage2 healthcheck" };
  await sql`
    insert into public.search_history (query, query_hash, language, mode, result)
    values (${hcQuery}, ${"__hc_search__"}, ${"zh"}, ${"standard"}, ${sql.json(hcResult)})
    on conflict (query_hash, language, mode) do update set result = excluded.result
  `;
  const [sh] = await sql`
    select id, query, result, expires_at from public.search_history where query_hash = ${"__hc_search__"}
  `;
  if (!sh || sh.result?.ok !== true) throw new Error("search_history 读写校验失败");
  console.log(`   ✅ search_history 读写正常(id=${sh.id},24h 过期=${sh.expires_at?.toISOString?.() ?? sh.expires_at})`);

  console.log("③ 验证 agent_memory 可读写 + 全文向量触发器…");
  await sql`
    insert into public.agent_memory (query, query_hash, recommendation, tags)
    values (${hcQuery}, ${"__hc_mem__"}, ${"建议体检通过"}, ${sql.array(["健康检查", "stage2"])})
    on conflict (query_hash) do update set recommendation = excluded.recommendation
  `;
  const [mem] = await sql`
    select id, query, search_vector, embedding from public.agent_memory where query_hash = ${"__hc_mem__"}
  `;
  if (!mem || !mem.search_vector) throw new Error("agent_memory 读写或 tsvector 触发器校验失败");
  console.log(`   ✅ agent_memory 读写正常(id=${mem.id},tsvector 已自动生成,embedding 列就绪=${mem.embedding === null ? "空(待阶段6)" : "有值"})`);

  console.log("④ 清理体检数据…");
  await sql`delete from public.search_history where query_hash = ${"__hc_search__"}`;
  await sql`delete from public.agent_memory where query_hash = ${"__hc_mem__"}`;
  console.log("   ✅ 清理完成");

  console.log("\n🎉 阶段 2 数据地基验证通过:两张表已建好且可读写。");
}

main()
  .catch((e) => {
    console.error("\n❌ 失败:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
