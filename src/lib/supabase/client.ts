import { createBrowserClient } from "@supabase/ssr";

// 浏览器端 Supabase 客户端。环境变量见 .env.example。
// 阶段 1 仅完成「接通」(代码就位),实际建表/读写在阶段 2。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
