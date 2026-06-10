// 运行时数据通道 smoke 测试。
// 用法:node scripts/smoke-data.mjs
// 验证:supabase-js + sb_secret_ key 经 PostgREST 能否写/读 search_history
//       (即 RLS 策略 auth.role()='service_role' 是否对新版 secret key 放行)。
// 这是阶段 6 analyze 接口运行时读写缓存/记忆的前提。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// 与 src/lib/utils/query-hash.ts 同一归一化+哈希逻辑(脚本内联,保持一致)。
const queryHash = (s) =>
  createHash("sha256")
    .update(s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase())
    .digest("hex");

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const hash = queryHash("__smoke_test__");

  console.log("① 用 secret key 经 PostgREST upsert search_history(验证 RLS 放行)…");
  const { error: upErr } = await supabase.from("search_history").upsert(
    {
      query: "__smoke_test__",
      query_hash: hash,
      language: "zh",
      mode: "standard",
      result: { ok: true, note: "smoke" },
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
    { onConflict: "query_hash,language,mode" },
  );
  if (upErr) throw new Error("写入失败(RLS 可能未对 secret key 放行): " + upErr.message);

  console.log("② 读回校验…");
  const { data, error: selErr } = await supabase
    .from("search_history")
    .select("id, result")
    .eq("query_hash", hash)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!data || data.result?.ok !== true) throw new Error("读回校验失败");
  console.log(`   ✅ 写入+读回正常(id=${data.id})`);

  console.log("③ 清理…");
  await supabase.from("search_history").delete().eq("query_hash", hash);
  console.log("   ✅ 清理完成");

  console.log("\n🎉 运行时数据通道(supabase-js + secret key + RLS)验证通过。");
}

main().catch((e) => {
  console.error("\n❌ 失败:", e.message);
  process.exitCode = 1;
});
