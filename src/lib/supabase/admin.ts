import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";

// 服务端专用 Supabase 客户端(service_role,绕过 RLS)。
// 仅可在服务端(Route Handler / 引擎 / 脚本)使用,严禁泄露到浏览器。
// 运行时写缓存(search_history)、沉淀记忆(agent_memory)走此客户端。
//
// 注意:用单例避免重复创建连接。
let adminClient: SupabaseClient<Database> | null = null;

export function createAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量(见 .env.example)",
    );
  }

  adminClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
