// 数据库行类型(与 Supabase 表结构一一对应)
// 对应 migration: supabase/migrations/0001_stage2_data_foundation.sql
// 命名遵循 PostgreSQL 习惯(snake_case),与 SQL 列名对齐。

import type { Language, ModelProvider, ScanMode } from "./common";
import type { FinalReport } from "./report";

// ==================== search_history(分析缓存) ====================

/**
 * 分析缓存表行。
 * 相同创意短期重查命中缓存(query_hash 唯一),24h 过期。
 * 免登录起步:user_id 可空。
 */
export type SearchHistoryRow = {
  id: string; // uuid
  query: string; // 用户原始创意/长文
  query_hash: string; // 归一化后的查询哈希(缓存键)
  language: Language;
  mode: ScanMode;
  /** 引擎完整产出(命中缓存直接复用) */
  result: FinalReport | null;
  /** 后台预生成的专业报告数据(后期 PDF,本阶段预留) */
  professional_report: unknown | null;
  model_provider: ModelProvider | null;
  user_id: string | null; // 免登录可空,接入账号后填
  created_at: string; // ISO 时间戳
  expires_at: string | null; // 缓存过期时间(created_at + 24h)
}

/** 写入 search_history 时的入参(带数据库默认值/自动生成的列可省略) */
export type SearchHistoryInsert = {
  id?: string;
  query: string;
  query_hash: string;
  language?: Language;
  mode?: ScanMode;
  result?: FinalReport | null;
  professional_report?: unknown | null;
  model_provider?: ModelProvider | null;
  user_id?: string | null;
  created_at?: string;
  expires_at?: string | null;
}

// ==================== agent_memory(记忆地基) ====================

/**
 * Agent 记忆表行(升级自旧库 agent_experiences)。
 * 双检索:tsvector 全文(立即可用) + pgvector 语义向量(阶段 6 接 embedding)。
 * search_vector(tsvector)由数据库触发器自动维护,不在行类型暴露。
 */
export type AgentMemoryRow = {
  id: number;
  query: string;
  query_hash: string; // 同一查询去重
  domain_id: string | null;
  sub_domain_id: string | null;
  /** 各 Agent 判断过程(结构化) */
  agent_judgments: Record<string, unknown>;
  final_score: number;
  recommendation: string;
  lessons_learned: string[]; // AI 提炼的经验教训
  quality_flags: string[];
  debate_summary: string;
  tags: string[]; // 技术标签(快速索引)
  /** pgvector 语义向量(1536 维)。阶段 6 接入 embedding 模型后写入,本阶段为空。 */
  embedding: number[] | null;
  usefulness_score: number; // 经验有用性 0-1
  model_provider: ModelProvider | string;
  execution_time_ms: number;
  created_at: string;
}

/** 写入 agent_memory 时的入参(带数据库默认值/自动生成的列可省略) */
export type AgentMemoryInsert = {
  id?: number;
  query: string;
  query_hash: string;
  domain_id?: string | null;
  sub_domain_id?: string | null;
  agent_judgments?: Record<string, unknown>;
  final_score?: number;
  recommendation?: string;
  lessons_learned?: string[];
  quality_flags?: string[];
  debate_summary?: string;
  tags?: string[];
  embedding?: number[] | null;
  usefulness_score?: number;
  model_provider?: ModelProvider | string;
  execution_time_ms?: number;
  created_at?: string;
}
