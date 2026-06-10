-- ==================================================================
-- 第一层 · 阶段 2:数据契约 + 记忆地基
-- 建 2 张表:search_history(分析缓存) + agent_memory(记忆,含 pgvector)
-- 幂等设计:可重复执行(IF NOT EXISTS / DO 块)
-- 在 Supabase SQL Editor 执行,或由建表脚本自动执行。
-- ==================================================================

-- 0. 启用 pgvector 扩展(语义向量检索)
create extension if not exists vector;

-- ==================================================================
-- 1. search_history —— 分析缓存表
--    相同创意短期重查命中缓存,24h 过期;免登录起步 user_id 可空。
-- ==================================================================
create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  query text not null,                       -- 用户原始创意/长文
  query_hash text not null,                  -- 归一化查询哈希(缓存键)
  language text not null default 'zh',       -- 'zh' | 'en'
  mode text not null default 'standard',     -- 'standard' | 'flash'
  result jsonb,                              -- 引擎完整产出 FinalReport
  professional_report jsonb,                 -- 后台预生成专业报告(后期 PDF,预留)
  model_provider text,
  user_id uuid,                              -- 免登录可空,接入账号后填
  created_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '24 hours'),
  -- 同一查询 + 语言 + 模式 只缓存一条最新结果
  unique (query_hash, language, mode)
);

create index if not exists idx_search_history_hash
  on public.search_history (query_hash);
create index if not exists idx_search_history_expires
  on public.search_history (expires_at);
create index if not exists idx_search_history_user
  on public.search_history (user_id);

-- ==================================================================
-- 2. agent_memory —— 记忆地基(升级自旧库 agent_experiences)
--    双检索:tsvector 全文(立即可用) + pgvector 语义向量(阶段 6 接 embedding)
-- ==================================================================
create table if not exists public.agent_memory (
  id bigserial primary key,
  query text not null,
  query_hash text not null,
  domain_id text,
  sub_domain_id text,
  agent_judgments jsonb not null default '{}',   -- 各 Agent 判断过程
  final_score real not null default 50,
  recommendation text not null default '',
  lessons_learned text[] default '{}',            -- AI 提炼的经验教训
  quality_flags text[] default '{}',
  debate_summary text default '',
  tags text[] default '{}',                       -- 技术标签
  search_vector tsvector,                         -- 全文检索向量(触发器维护)
  embedding vector(1536),                         -- pgvector 语义向量(1536 维,阶段 6 填充)
  usefulness_score real default 0.5,              -- 经验有用性 0-1
  model_provider text default 'minimax',
  execution_time_ms int default 0,
  created_at timestamptz not null default now(),
  unique (query_hash)                             -- 同一查询去重,保留最新
);

-- 2.1 触发器:插入/更新时自动生成全文检索向量
create or replace function public.update_agent_memory_search_vector()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.query, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.recommendation, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.debate_summary, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.lessons_learned, ' '), '')), 'B');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agent_memory_search_vector on public.agent_memory;
create trigger trg_agent_memory_search_vector
  before insert or update on public.agent_memory
  for each row execute function public.update_agent_memory_search_vector();

-- 2.2 索引
create index if not exists idx_agent_memory_query_hash
  on public.agent_memory (query_hash);
create index if not exists idx_agent_memory_domain
  on public.agent_memory (domain_id);
create index if not exists idx_agent_memory_score
  on public.agent_memory (final_score);
create index if not exists idx_agent_memory_created
  on public.agent_memory (created_at desc);
create index if not exists idx_agent_memory_tags
  on public.agent_memory using gin (tags);
create index if not exists idx_agent_memory_search_vector
  on public.agent_memory using gin (search_vector);
-- pgvector 语义检索索引(HNSW,余弦距离;空列也可建,阶段 6 有数据后即生效)
create index if not exists idx_agent_memory_embedding
  on public.agent_memory using hnsw (embedding vector_cosine_ops);

-- ==================================================================
-- 3. 行级安全(RLS)
-- ==================================================================
alter table public.search_history enable row level security;
alter table public.agent_memory   enable row level security;

-- 3.1 search_history:缓存可公开读(免登录/分享),写入仅 service_role
do $$
begin
  if not exists (select 1 from pg_policies
    where tablename = 'search_history' and policyname = 'search_history public read') then
    create policy "search_history public read"
      on public.search_history for select using (true);
  end if;
  if not exists (select 1 from pg_policies
    where tablename = 'search_history' and policyname = 'search_history service write') then
    create policy "search_history service write"
      on public.search_history for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- 3.2 agent_memory:经验库公开只读,写入仅 service_role
do $$
begin
  if not exists (select 1 from pg_policies
    where tablename = 'agent_memory' and policyname = 'agent_memory public read') then
    create policy "agent_memory public read"
      on public.agent_memory for select using (true);
  end if;
  if not exists (select 1 from pg_policies
    where tablename = 'agent_memory' and policyname = 'agent_memory service write') then
    create policy "agent_memory service write"
      on public.agent_memory for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- ==================================================================
-- 完成:2 张表 + 1 触发器 + 10 索引 + 4 条 RLS 策略
-- ==================================================================
