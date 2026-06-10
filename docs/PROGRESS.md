# 实时进度跟踪（PROGRESS）

> 新 session 开局：先读 `HANDOFF.md` → 本文件 → `PLAN.md`，然后继续工作。

## 当前阶段

**第一层·阶段 2（数据契约 + 记忆地基）已完成**(2026-06-10) —— 数据契约类型 + 两张 Supabase 表均就位,类型编译通过、表读写验证通过。下一步进入阶段 3(引擎骨架)。

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
- [ ] **下一步:第一层·阶段 3(引擎骨架)**:`core/pipeline` 管线接口+注册(铁律①);`core/orchestrator` 分层骨架;`core/ai-client`(Vercel AI SDK + 信号量/降级/熔断/Key池)。验收:脚本能调通模型、跑通空管线。详见 `PLAN.md`。
- 后续阶段 4–9 见 `PLAN.md` B 部分。

## 关键决策记录

- 2026-06-10：仓库已推送 GitHub（`github.com/Joe7921/Novoscan-Cloud`,默认分支 `main`）;git 身份改为 `Joe7921 <zhouhaoyu6666@gmail.com>`,历史两次提交作者已改写。
- 2026-06-10：阶段 2 决策——① 建表方式=用户提供 Supabase 连接凭据,我连库建表并验证（非让用户手动跑 SQL）;② pgvector 向量维度=**1536**（兼容 OpenAI text-embedding-3-small,一旦建表固定,改维度需迁移）。
- 2026-06-10：记忆表由旧库纯 tsvector 升级为 **tsvector + pgvector 双检索**;旧表名 `agent_experiences` → 新表名 `agent_memory`。
- 2026-06-10：Supabase 项目=`tmemhecjmlxdpwolltlv`(首尔 `ap-northeast-2`)。本机无 IPv6,**Direct 直连不可用**,数据库脚本固定走 **Session pooler**(`aws-1-ap-northeast-2.pooler.supabase.com:5432`,user=`postgres.<ref>`)。`.env.local` 已配 URL/publishable/secret/DATABASE_URL(均本地,git 忽略)。
- 2026-06-10：技术坑记录——`createClient<Database>` 的 `Database` 类型里,表的 `Row`/`Insert` **必须用 `type` 而非 `interface`**(interface 不满足 supabase-js 要求的隐式索引签名,否则 upsert/insert 入参被推断成 `never`)。故 `db.ts` 四个表类型用 `type`。
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
