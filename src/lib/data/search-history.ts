import { createAdminClient } from "@/lib/supabase/admin";
import { queryHash } from "@/lib/utils/query-hash";
import type { FinalReport, Language, ModelProvider, ScanMode } from "@/lib/types";

// search_history 缓存表的数据访问层(服务端,走 service_role)。
// 阶段 6 的 analyze 接口在跑引擎前先查缓存、跑完后写缓存。

const TABLE = "search_history";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * 读缓存:命中同一 (query, language, mode) 且未过期时返回引擎报告,否则 null。
 * 注:即使 DB 里 expires_at 已过,这里也再判一次,过期当未命中。
 */
export async function getCachedReport(
  query: string,
  language: Language,
  mode: ScanMode,
): Promise<FinalReport | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("result, expires_at")
    .eq("query_hash", queryHash(query))
    .eq("language", language)
    .eq("mode", mode)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as { result: FinalReport | null; expires_at: string | null };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return null; // 已过期,视为未命中(由后续写入覆盖)
  }
  return row.result ?? null;
}

/**
 * 写缓存:按 (query_hash, language, mode) upsert,刷新 24h 过期时间。
 * 相同创意短期重查即命中。
 */
export async function saveCachedReport(params: {
  query: string;
  language: Language;
  mode: ScanMode;
  result: FinalReport;
  modelProvider?: ModelProvider;
  userId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      query: params.query,
      query_hash: queryHash(params.query),
      language: params.language,
      mode: params.mode,
      result: params.result,
      model_provider: params.modelProvider ?? null,
      user_id: params.userId ?? null,
      expires_at: new Date(Date.now() + TTL_MS).toISOString(),
    },
    { onConflict: "query_hash,language,mode" },
  );
  if (error) throw error;
}
