// Supabase Database 类型(供 createClient<Database> 获得端到端类型安全)。
// 复用 db.ts 的行/写入类型,与 migration 0001 的两张表对应。
// 注:目前手写维护;表结构变动时需同步此文件(后续可改用 supabase gen types 自动生成)。

import type {
  AgentMemoryInsert,
  AgentMemoryRow,
  SearchHistoryInsert,
  SearchHistoryRow,
} from "./db";

export interface Database {
  public: {
    Tables: {
      search_history: {
        Row: SearchHistoryRow;
        Insert: SearchHistoryInsert;
        Update: Partial<SearchHistoryInsert>;
        Relationships: [];
      };
      agent_memory: {
        Row: AgentMemoryRow;
        Insert: AgentMemoryInsert;
        Update: Partial<AgentMemoryInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
