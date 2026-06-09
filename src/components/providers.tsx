"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUIStore } from "@/lib/store/ui-store";

// 全局客户端 Provider:TanStack Query + 触发 Zustand 本地存储注水。
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );

  // 挂载后再从 localStorage 恢复 UI 状态(语言/当前板块),避免 hydration 不匹配。
  useEffect(() => {
    void useUIStore.persist.rehydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
