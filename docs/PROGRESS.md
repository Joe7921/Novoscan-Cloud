# 实时进度跟踪（PROGRESS）

> 新 session 开局：先读 `HANDOFF.md` → 本文件 → `PLAN.md`，然后继续工作。

## 当前阶段

**第一层·阶段 4(双轨检索)学术轨完成**(2026-06-10) —— 学术四源 + 关键词 + **证据闸门(相关性重排过滤,治"垃圾进")** + 聚合,免费源真实验收通过(召回 16→闸门 15)。**验收①已通过**(DeepSeek `deepseek-v4-pro` + 中转站 Claude `claude-opus-4-7-thinking`),证据闸门 **LLM 重排实测生效**(弱相关被精准过滤)。下一步:阶段4-B 产业轨 + 双轨交叉验证/可信度。

## 已完成

- [x] 工作区初始化：`.claude/settings.json`、`CLAUDE.md`、`docs/`、`git init` + 首次提交 `3577c2b`
  - 本仓库 git 身份：`Novoscan` / `BarnesBurnsmtm@therapist.net`（仅本仓库；用户如需可改）
- [x] 通读旧库 → `docs/OLD-CODEBASE-ANALYSIS.md`
- [x] 产品定位、终极形态（5 楼层）、架构、施工顺序、全套技术栈 —— **全部敲定**
- [x] 文档落盘：`HANDOFF.md` / `REFACTOR-PRD.md` / `ARCHITECTURE.md` / `TECH-STACK.md` / `PLAN.md`（本套即交接文档）
- [x] **第一层·阶段 1：工程骨架 + Claude Desktop 式外壳**（2026-06-09）
  - 初始化 Next.js **16.2.7** + React 19 + TS + Tailwind v4 + shadcn/ui（base-ui + lucide）；用户拍板用「最新稳定版」而非文档原写的 14。
  - 目录结构按 `PLAN.md` 落地:`src/{app,core,components,lib}`;`core/` 引擎结构占位（见 `src/core/README.md`,铁律①②）。
  - i18n 中英双语（`lib/i18n` 字典 + Zustand 存当前语言 + 客户端注水避免 hydration 警告）。
  - 状态/数据接入:Zustand(`lib/store/ui-store.ts`) + TanStack Query(`components/providers.tsx`)。
  - Claude Desktop 式外壳:左侧板块导航(仅「创新分析」激活,其余 3 个占位「即将上线」) + 右侧主区域 + 语言切换器。
  - Supabase 客户端代码就位(`lib/supabase/{client,server}.ts`,`@supabase/ssr`);**仅接通,未建表**。环境变量见 `.env.example`。
  - ✅ 验收:`npm run build` 通过;`npm run start` 抓取页面四板块文案 + 标语 + 「即将上线」徽标均正确,默认中文。

## 进行中 / 下一步

- [x] **第一层·阶段 2:数据契约 + 记忆地基**（2026-06-10,已完成）
  - [x] 数据契约 `src/lib/types/`:`common`/`search`/`agent`/`report`/`db`/`index` 六文件,参考旧库 `types.ts`+`agents/types.ts` 重写(非复制)。`npx tsc --noEmit` 通过。
  - [x] 建表 migration `supabase/migrations/0001_stage2_data_foundation.sql`:`search_history`(缓存,query_hash+lang+mode 唯一,24h 过期,RLS) + `agent_memory`(记忆,tsvector 全文触发器 + **pgvector vector(1536)** 骨架 + HNSW 索引,RLS)。幂等可重复执行。
  - [x] service_role 客户端 `src/lib/supabase/admin.ts`(运行时写缓存/记忆,后续阶段用);`.env.example` 增 `SUPABASE_SERVICE_ROLE_KEY`+`DATABASE_URL`。
  - [x] 建表+读写验证脚本 `scripts/db-setup.mjs`(postgres 直连执行 DDL + 两表读写体检 + 清理);装 `postgres` devDep。
  - [x] 连库建表 + 读写验证(验收②):经 **Session pooler**(`aws-1-ap-northeast-2`;Direct 直连 `db.*.supabase.co` 因 IPv6-only 在本机 DNS 解析失败,故改 IPv4 兼容的 pooler)跑 `node scripts/db-setup.mjs`——两表建好、读写正常、tsvector 触发器生效、`embedding vector(1536)` 列就绪(待阶段 6 填充)。
  - [x] 地基加固(阶段 3 前置,2026-06-10):`lib/utils/query-hash.ts`(NFKC 归一化 + SHA-256,统一缓存/去重键);`lib/data/{search-history,agent-memory}.ts`(缓存读写 + 记忆沉淀/全文检索封装);`lib/types/supabase.ts`(`Database` 类型 → client 端到端类型安全)。`scripts/smoke-data.mjs` 实测 **secret key 经 PostgREST 可过 RLS 读写**(阶段 6 运行时通道验证可用)。
- [~] **第一层·阶段 3:引擎骨架**(2026-06-10,代码完成,详见 `PLAN.md` C 部分)
  - [x] `core/ai-client`:config/provider-registry/key-pool/circuit-breaker/semaphore/parse/call/index(Vercel AI SDK v6 + 降级链/熔断/Key池/退避/超时/JSON自愈/成本占位)。
  - [x] `core/agents`:AgentDefinition 契约 + 8 个占位 stub(学术/产业/竞品/跨域/创新/辩论/仲裁/质检)。
  - [x] `core/pipeline`:PipelineDefinition 契约 + 注册表 + 内置「Novoscan 默认管线」(`novoscan-default`,通用型)。
  - [x] `core/orchestrator`:通用分层调度(majority 推进、关键路径vs后台、条件触发、时间预算、降级不崩、onProgress)。
  - [x] 验收②(空管线):`npx tsx scripts/smoke-pipeline.ts` 跑通,报告结构完整、辩论条件正确跳过。tsc 通过。
  - [ ] **待办(需用户)**:把 AI Key 填进 `.env.local`(`DEEPSEEK_API_KEY`/`MINIMAX_API_KEY`/`MOONSHOT_API_KEY`/`ANTHROPIC_API_KEY` 任一组)→ 跑 `npx tsx scripts/smoke-ai.ts` 完成**验收①**。
- [~] **第一层·阶段 4:双轨检索**(2026-06-10,学术轨完成)
  - [x] 学术四源 `core/search/academic/`:OpenAlex/arXiv/CrossRef(免费真接)+ CORE(按 key);各源失败优雅返回空。
  - [x] 关键词提取 + 中英双语变体 `keyword.ts`(AI 优先,无 key 本地分词降级)。
  - [x] **证据闸门** `rerank.ts`:相关性重排+过滤,治旧库"垃圾进垃圾出"——LLM 重排(国产 key)为主,无 key 退化为"只排序不过滤"(规则无跨语言语义,避免误杀)。
  - [x] 学术聚合 `academic-aggregate.ts` → `AcademicResult`(去重+证据闸门+统计);封装为 `search.academic` EngineTool。
  - [x] 验收:`npx tsx scripts/smoke-search.ts` 免费源真实返回 + 闸门 + 统计,tsc 通过。
  - [ ] **下一步(阶段4-B)**:产业多源 + 降级链 + 引擎选择 + 双轨交叉验证/可信度评分。
- 后续阶段 5–9 见 `PLAN.md` B 部分。

## 关键决策记录

- 2026-06-10：仓库已推送 GitHub（`github.com/Joe7921/Novoscan-Cloud`,默认分支 `main`）;git 身份改为 `Joe7921 <zhouhaoyu6666@gmail.com>`,历史两次提交作者已改写。
- 2026-06-10：阶段 2 决策——① 建表方式=用户提供 Supabase 连接凭据,我连库建表并验证（非让用户手动跑 SQL）;② pgvector 向量维度=**1536**（兼容 OpenAI text-embedding-3-small,一旦建表固定,改维度需迁移）。
- 2026-06-10：记忆表由旧库纯 tsvector 升级为 **tsvector + pgvector 双检索**;旧表名 `agent_experiences` → 新表名 `agent_memory`。
- 2026-06-10：Supabase 项目=`tmemhecjmlxdpwolltlv`(首尔 `ap-northeast-2`)。本机无 IPv6,**Direct 直连不可用**,数据库脚本固定走 **Session pooler**(`aws-1-ap-northeast-2.pooler.supabase.com:5432`,user=`postgres.<ref>`)。`.env.local` 已配 URL/publishable/secret/DATABASE_URL(均本地,git 忽略)。
- 2026-06-10：技术坑记录——`createClient<Database>` 的 `Database` 类型里,表的 `Row`/`Insert` **必须用 `type` 而非 `interface`**(interface 不满足 supabase-js 要求的隐式索引签名,否则 upsert/insert 入参被推断成 `never`)。故 `db.ts` 四个表类型用 `type`。
- 2026-06-11：模型落定——DeepSeek `deepseek-v4-pro`(双 key 池 NVC1/NVC2 轮换);Claude 走**中转站 Vectrust**(`ANTHROPIC_BASE_URL=https://api.openai-next.com/v1`、model `claude-opus-4-7-thinking`、x-api-key 鉴权);国产默认名升级 `deepseek-v4-flash`(旧 deepseek-chat 7/24 弃用)。验收①+证据闸门 LLM 重排实测通过。
- 2026-06-10：检索质量决策——针对旧库「垃圾进垃圾出」(召回后无相关性过滤),新架构在「检索完 → 喂 Agent 前」加 **证据闸门**:相关性重排 + 过滤 + 充分性标记。重排策略 = **LLM 重排**(国产模型逐条打分),无 key 降级为规则排序(**不过滤**,避免跨语言误杀);将来可插 embedding 重排(阶段6)。
- 2026-06-10：架构决策——Agentic 采用「**双轨并存 + 工具层统一**」(非替换固定管线):数据源与子 Agent 封装为统一 `EngineTool`,固定管线(可信模式)与 Agentic 模式(施工第3步)共享同一套工具。已建 `core/tools/`(契约+注册表+AI SDK 适配器)。阶段4 数据源、阶段5 子 Agent 按此实现。详见 ARCHITECTURE/PLAN。
- 2026-06-10：阶段3 决策——① 混合模型:国产三家(DeepSeek/Minimax/Moonshot)打主力(L1 分散 + L2),**Sonnet 4.6** 用于 L2.5 辩论 + L3 仲裁(可信度核心);② 首条管线=「Novoscan 默认管线」(`novoscan-default`,通用型),自制/行业管线在其外新增,它是 Agentic Mode(施工第3步,**尚未开工**)的地基;③ AI SDK 实测 **v6**(`ai` 6.0.199 / `@ai-sdk/anthropic` 3 / `@ai-sdk/openai-compatible` 2),用 `maxOutputTokens`/`createOpenAICompatible`/`createAnthropic`;④ 国产默认模型名(minimax `MiniMax-Text-01`、moonshot `kimi-k2-0905-preview`)为推测值,可经 `*_MODEL` 环境变量覆盖。
- 2026-06-10：⚠️ 待用户做的安全收尾——数据库密码与 `sb_secret_` 曾出现在对话中,建议全部弄完后在 Supabase 各 roll(重置)一次,并相应更新 `.env.local`。
- 2026-06-09：技术栈由 AI 探测确认（Next.js 14/React/TS/Tailwind/Supabase/npm/Turbo）。
- 2026-06-09：目标=网页应用 + 全栈重写（含 Agent 核心）；本期聚焦核心分析闭环。
- 2026-06-09：免登录 / 仅标准深度模式 / 中英双语 / 沿用 Novoscan。
- 2026-06-09：目标用户=专业三人群；核心价值=分析够深、结论服人 → **可信度优先**。
- 2026-06-09：用户输入=长文先行，文档/链接解析紧随（阶段 8）。
- 2026-06-09：终极形态=「线上办公楼」5 楼层，共享管线引擎（心脏）。
- 2026-06-09：架构=心脏(引擎)+柱①(项目状态)+柱②(创作分发)+🧠记忆层+地基。
- 2026-06-09：施工顺序把 **Flip 提前**（投资人批量=早期付费点），连带账号/队列/计费提前。
- 2026-06-09：阶段 1 框架版本由用户拍板用「最新稳定版」(实际 Next 16.2.7)，文档原写的 14 已作废。
- 2026-06-09：**遗留事项**(下次处理)：① 根目录 `scaffold-tmp/` 为脚手架临时残留(含 `.next` 缓存)，环境禁用 `rm`/PowerShell 致无法自动删除，需用户手动删或后续放行；② Supabase 仅接通代码，未填 `.env.local` 密钥、未建表(阶段 2 处理)。
- 2026-06-09：技术栈全部确认 → 见 `TECH-STACK.md`（引擎混合运行/编排混合/Inngest/Supabase+pgvector/shadcn+Zustand+TanStack/unpdf+mammoth+Jina/Supabase Auth+Lemonsqueezy）。

## 交接说明

本次为规划+文档交接节点。用户将在 Claude Desktop 新对话接力。新对话从 `docs/HANDOFF.md` 开始。
