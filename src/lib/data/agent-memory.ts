import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeQuery, queryHash } from "@/lib/utils/query-hash";
import type { AgentMemoryInsert, AgentMemoryRow } from "@/lib/types";

// agent_memory 记忆表的数据访问层(服务端,走 service_role)。
// 阶段 5/6:分析完沉淀经验、分析前 RAG 召回相关经验注入 Agent。

const TABLE = "agent_memory";

/**
 * 沉淀一条分析经验,按 query_hash 去重(同一查询覆盖为最新)。
 * query_hash 由 query 自动算出,调用方无需传。
 * embedding(语义向量)留到阶段 6 接入 embedding 模型后回填,这里不写。
 */
export async function saveExperience(
  exp: Omit<AgentMemoryInsert, "query_hash">,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ ...exp, query_hash: queryHash(exp.query) }, { onConflict: "query_hash" });
  if (error) throw error;
}

/**
 * 检索相关历史经验。
 * 阶段 2:走 tsvector 全文检索(config=simple,按词/空白匹配;中文召回有限)。
 * 阶段 6:增加 pgvector 语义召回(embedding 余弦近邻)作为主力,本函数届时升级为混合检索。
 */
export async function searchMemories(
  query: string,
  limit = 5,
): Promise<AgentMemoryRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .textSearch("search_vector", normalizeQuery(query), {
      type: "plain",
      config: "simple",
    })
    .order("usefulness_score", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as AgentMemoryRow[]) ?? [];
}
