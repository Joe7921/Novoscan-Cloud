# 实时进度跟踪（PROGRESS）

> 新 session 开局：先读 `HANDOFF.md` → 本文件 → `PLAN.md`，然后继续工作。

## 当前阶段

**第一层·阶段 7(分析板块前端·三态)代码完成**(2026-06-15) —— 把 SSE 接口接成完整网页三态:输入态 → 分析中态(总进度 + phase + 8 张 Agent 状态卡 + 检索摘要 + 实时日志 + 取消)→ 报告态(结论概览卡:总分/推荐/可信度/共识 + recharts 灰阶六维雷达;分区折叠:学术[含相似论文可点溯源]/产业/竞品/创新[逐维 reasoning]/跨域/辩论异议/仲裁加权透明表/原始数据)+ 错误态。SSE 消费 Hook `useAnalyze`(useReducer 状态机 + `\n\n` 分帧 + 心跳行忽略 + AbortController 取消)。缓存命中显"缓存结果"徽标 + 刷新重生成;部分结果/降级显低置信横幅;dualTrack=null 兜底。**方向决策**(用户 2026-06-14):概览+分区折叠、引入 recharts(灰阶单色)、仅灰阶+红不引语义色。`npx tsc --noEmit` + `npm run build` 双绿;dev 起服首页 200、输入态渲染正常、日志零报错。**待跑**:端到端真跑一次(烧 AI,验报告态全模块 + recharts 雷达),时机由用户定。下一步:阶段 8(富输入)或先真跑联调阶段 6+7。

**第一层·阶段 6(analyze SSE 接口 + 缓存/记忆沉淀)代码完成**(2026-06-13,务实版) —— 把阶段 5 已验证的引擎接成网页可调用的 SSE 流式接口。`POST /api/analyze`:校验入参 → `ReadableStream` 包 SSE,客户端断开转发 `abortSignal` 取消引擎。编排核心 `lib/analyze/run-analysis.ts`(引擎/界面分离,铁律②):查缓存(命中秒回)→ tsvector 记忆召回注入 `memoryContext` → 双轨检索 → `runPipeline(novoscan-default)` → 吐报告(附原始数据)→ best-effort 沉淀缓存(24h)+ 记忆(`reportToMemory` 映射)。**记忆注入零改动**:管线 `baseFields` 已透传 `memoryContext`、`shared.memoryBlock` 已注入 prompt。`npx tsc --noEmit` + `npm run build` 双绿,`/api/analyze` 注册为动态路由。**待跑**:`scripts/smoke-analyze.ts` 真实端到端验收(需 AI key + DB,有成本,等用户拍板何时跑)。pgvector 语义召回 + Inngest 异步化按用户决策留 TODO 接入点。下一步:阶段 7(分析板块前端三态)。

**第一层·阶段 5(第一条管线·真子 Agent)已完成**(2026-06-11) —— 8 个占位 stub 全部替换为真子 Agent(实现为 `EngineTool`,category=agent),`novoscan-default` 管线升级 `toolRef + mapInput`,经真实 AI 端到端跑通:双轨检索 → L1(学术/产业/竞品/跨域)→ L2 创新评估(六维雷达)→ L2.5 条件辩论(NovoDebate 多轮真对抗)→ L3 仲裁(透明加权)→ L4 质检。**实测验收 6/6 通过**:四核心 Agent 真实完成(学术 65/产业 30/竞品 85/创新 28,各自独立评分)、六维雷达非退化、辩论触发 3 轮、仲裁产出「谨慎考虑 42 分」决策摘要、质检 passed=true。

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
  - [x] 阶段4-B:产业六源(Brave/SerpAPI/Serper/Tavily/SearXNG/GitHub,无 key 自动跳过)+ 引擎选择(AI/规则)+ 产业聚合 + **双轨交叉验证/可信度评分**;封装 `search.industry`/`search.dual` EngineTool。`smoke-dual` 验收跑通(学术 19 + 开源 9 + 可信度 85)。
  - [x] 模型三档(`callByTier`:fast 非思考/standard/strong)+ **GIGO 修复**(非思考模型做简单活、GitHub 英文搜+repos 过闸门、网页过闸门)。
- [x] **第一层·阶段 5:第一条管线·真子 Agent**(2026-06-11,已完成)
  - [x] 工具层迁移:8 个 Agent 实现为 `EngineTool`(`core/agents/*.ts`,category=agent),注册进工具表;`core/agents/shared.ts` 收口公共辅助(截断/归一化/阈值/语言/领域块)。
  - [x] L1:学术审查员(相似论文对比)、产业分析员(GitHub≤15% 纠偏)、竞品侦探(竞品≠开源纠偏)、跨域侦察兵(底层原理迁移+知识图谱,后台非关键)。
  - [x] L2 创新评估师(交叉质疑 + 六维雷达 + 防退化重试);L2.5 NovoDebate 辩论引擎(挑战/反驳/裁判独立调用,攻防走 fast 档、裁判走 strong 档,收敛检测+降级纯逻辑裁判);L3 仲裁员(动态权重+冲突矩阵+辩论/跨域注入+透明加权,加权明细由代码回填保证准确);L4 质检(纯逻辑零 AI)。
  - [x] 编排器升级:`PipelineStep` 增 `toolRef + mapInput`(toolRef 优先,agentRef 兼容 stub);`orchestrator.runStep` 走工具执行路径(`tool.inputSchema.parse(mapInput(...))`);默认管线 step 全部改 toolRef,模型按三档分派。
  - [x] **超时校准(实测)**:思考模型大 prompt+16K 输出单次可达 90-110s。`TIMEOUTS.agentMs` 70→120s、`arbitratorMs` 95→150s、总预算 300→480s;学术/跨域(大输出)单 step 放宽到 200s。
  - [x] 辩论 GIGO 修复:`isFallback` 降级占位 Agent 不参与辩论(避免逼模型编证据)。
  - [x] 验收:`scripts/smoke-agents.ts` 真实 AI 端到端 6/6 通过;`scripts/smoke-pipeline.ts` 改为 stub 克隆管线只验结构(无 Key 可跑);`npx tsc --noEmit` 通过。
- [x] **第一层·阶段 6:analyze SSE 接口 + 缓存/记忆沉淀**(2026-06-13,代码完成,详见 `PLAN.md` F 部分)
  - [x] `lib/analyze/types.ts`:`AnalyzeRequest` + `AnalyzeStreamEvent`(引擎透传 progress/log/agent_state/agent_thinking + 路由级 phase/memory/search/report/error/done)。
  - [x] `lib/analyze/run-analysis.ts`:`runAnalysis(req,emit,signal)` 编排——缓存→记忆召回(tsvector)→双轨检索→管线→吐报告→沉淀;`forwardEngineEvent` 转引擎进度,`reportToMemory` 映射沉淀,缓存/记忆全 best-effort 不阻塞。
  - [x] `app/api/analyze/route.ts`:`POST` 校验(query≥4 字)→ SSE `ReadableStream`,`req.signal` 转 `abortSignal`,客户端断开停写 + 跳过沉淀。
  - [x] `scripts/smoke-analyze.ts`:直调验收脚本(首次跑完整管线 + 二次命中缓存 + 沉淀)。
  - [x] **全量自查 + 独立审查 Agent 交叉复查后修复**(2026-06-14):① `modelProvider` 加白名单校验(防非法值污染缓存/记忆两表);② 路由加 15s SSE 心跳保活(防单 AI 调用静默 90-110s 被反代/浏览器断连);③ 长文 query 截断到 400 字再喂 tsvector(防 plainto_tsquery 超长报错致记忆召回静默失效);④ `reportToMemory` 数组字段全加 `?? []` 兜底(防降级时沉淀静默失败);⑤ 检索后加 `signal.aborted` 边界,断开则不启动昂贵管线;⑥ `forwardEngineEvent` log 的 `JSON.stringify` 加 try/catch;⑦ **smoke 脚本真查库**验证记忆沉淀(原脚本声称"记忆表新增一行"却从没碰过 DB——核心偷懒点已修),缓存命中改用 `fromCache` 强判据。
  - [x] 验收:`npx tsc --noEmit` + `npm run build` 双绿,`/api/analyze` 注册为动态路由。**运行时冒烟(免 AI 成本)**:dev 起服,curl 三条 400 校验全对(空 query/非法 JSON/过短);合法 query 短连 4s,SSE 响应头 + `data:` 分帧 + phase 事件正确流出,检索阶段断开后管线未启动(abort 边界生效、无报错、未烧 AI)。
  - [ ] **待跑(需用户,有成本)**:`npx tsx scripts/smoke-analyze.ts` 真实端到端(AI key + DB);或 `npm run dev` 后 `curl -N` POST。
  - [ ] **留 TODO**:pgvector 语义召回(现 tsvector)、Inngest 异步化(现请求内联)——按用户「务实版」决策本阶段不实现,接入点已留好。
- [x] **第一层·阶段 7:分析板块前端·三态**(2026-06-15,代码完成)
  - [x] SSE 消费 Hook `lib/analyze/use-analyze.ts`(useReducer 四态机:idle/analyzing/done/error;解析 `data:` 行、忽略心跳、半包 buffer;AbortController cancel/reset)。
  - [x] UI 基础件 `components/ui/`:card/badge/progress/separator(手写、灰阶、贴 button 风格)。
  - [x] 三态组件 `components/boards/analysis/`:input-state / analyzing-state / agent-card;`analysis-board` 容器据 status 切四态 + 刷新/重试。
  - [x] 报告组件 `components/report/`:report-view(根)/ verdict-overview(结论卡)/ radar-chart(recharts 灰阶)/ collapsible-section / score-bar / field-list / confidence-badge / agent-section / similar-papers / arbitration-section / debate-section / raw-data-section。
  - [x] i18n:`dictionaries.ts` 扩 `board.analysis`(三态文案)+ 新增 `report` 段(zh/en TS 强制对齐)。
  - [x] 依赖:`recharts@^3`(唯一新增,React19/Next16 兼容)。
  - [x] 验收:tsc + build 双绿;dev 首页 200、输入态正常、零报错。
  - [x] **端到端真跑联调成功**(2026-06-15):经真实 `POST /api/analyze` SSE,223s 完整跑通——5 phase + 16 agent_state(8 Agent×起止)+ search + report + done;8 个 Agent 全真实(无 STUB/降级):学术 86 / 产业 0 / 竞品 88 / 创新 8、5 篇相似论文、六维雷达非退化、辩论触发 1 场、仲裁 42「不推荐」走中转站 `claude-opus-4-7-thinking`、加权明细透明、跨域 6 桥、质检 passed。**缓存命中验证**:同 query 二次 fromCache=true、1.5s(vs 223s)、同分 42。报告态全模块数据契约正确。
  - 红线遵守:未改 globals.css 主题/layout/sidebar/app-shell;配色严格灰阶+红。
  - ✅ **"乱码"问题已查清=测试工具 artifact,非引擎 bug**(2026-06-15 复盘,纠正先前误判):echo 服务器实测——Bash 工具在中文 Windows 环境下发 curl,命令里的中文被编成 **GBK**(如"用"= `d3c3`,正确 UTF-8 应为 `e794a8`)送出,服务端按 UTF-8 解码 → 真乱码(解码串含 U+FFFD)。三个 L1 Agent **没有幻觉**,是诚实报告了它们收到的乱码输入,引擎反而很稳健(未崩、从证据反推主题、如实标注)。**应用无此 bug**:浏览器 `fetch + JSON.stringify` 恒发 UTF-8。AI 调用层回显测试(fast/standard 双档)中文原样返回,确认调用链不乱码。⚠️ 推论:后续所有用 Bash/curl 发中文请求体的测试都会踩 GBK 坑,须从 UTF-8 文件 `--data-binary @file` 发,或直接浏览器测。
  - ⚠️ 次要:产业轨 0 结果(网页0/开源0)=大概率未配 Brave/Serper/Tavily 等产业搜索 key,可选补配(非 bug,无 key 自动跳过是设计)。
- 后续阶段 8–9 见 `PLAN.md` B 部分。

## 关键决策记录

- 2026-06-14:阶段 7 三方向(用户拍板)——① 报告布局=概览+分区折叠;② 六维雷达=引入 recharts(用现有灰阶 chart token 配成单色,非默认彩色);③ 配色=仅灰阶+红(只用 destructive 红标红旗/风险,不引绿/琥珀语义色,不动设计风格)。引擎/界面分离:`useAnalyze` Hook 只消费 `AnalyzeStreamEvent`,不含业务逻辑。

- 2026-06-13：阶段 6 范围——用户选 **务实版**:记忆召回先用现成 tsvector 全文检索注入 Agent;pgvector 语义召回、Inngest 异步队列只留 TODO 接入点(避免额外 embedding key/成本)。引擎/界面分离落地:编排逻辑放 `lib/analyze`(纯回调),路由 `api/analyze` 只做 HTTP↔SSE 转换,便于脚本直测与将来 Inngest 异步化。
- 2026-06-11：用户指示——**不要复用旧库代码,全部手动重写**(已写入 CLAUDE.md 工作区规则,取代原"参考旧代码逻辑重写"条款)。待确认:是否追溯适用于阶段 5 已落地的 Agent 提示词(其参考了旧库 prompt 结构重写)。
- 2026-06-11：阶段 5 决策——① Agent 落地为 `EngineTool`(非旧库的裸函数),管线 step 由 `agentRef` 升级为 `toolRef + mapInput`(入参从前序结果显式映射),与 Agentic 模式(施工第3步)共享同一套工具,零返工;阶段 3 stub 经 `agentRef` 保留,供无 Key 结构性 smoke。② 仲裁加权明细(`weightedBreakdown`)由代码预计算后回填,模型只输出 summary/score/裁决文本——防止模型自报数字算错,保证透明数据准确。③ 辩论攻防发言走 fast 非思考档(短输出,思考模型会被 reasoning 吃光正文),裁判走 step 指定的 strong 档(推理质量关键)。
- 2026-06-11：⚠️ 中转站坑——本机 shell 预置了 `ANTHROPIC_BASE_URL=https://api.anthropic.com`(空 `ANTHROPIC_MODEL`),会**覆盖** `.env.local`,导致 Claude 走官方端点 404。跑 CLI 脚本须 `env -u ANTHROPIC_BASE_URL -u ANTHROPIC_MODEL -u ANTHROPIC_API_KEY` 清除 shell 注入,让 `.env.local`(Vectrust 中转站)生效。Next.js 运行时不读 shell 环境,仅此类 CLI 脚本受影响。
- 2026-06-11：⚠️ 已知待优化——跨域侦察兵(输出最大:桥梁+知识图谱)偶发"无法解析 JSON"(16384 token 被 reasoning + 大 JSON 吃光后截断,四级自愈也救不回);它是后台非关键不阻塞,但阶段 6/7 前应提高其 `maxOutputTokens` 或拆分输出。
- 2026-06-11：超时经验值——思考模型(deepseek-v4-pro / claude-opus 思考版)大 prompt + 16K 输出单次 90-110s 是常态,"慢"非瞬时故障,单次长跑(180s)优于多次重试。L1 majority=2 保证慢 Agent 不阻塞推进,迟到结果仍入最终报告。`TIMEOUTS.agentMs`=120s/`arbitratorMs`=150s/总预算=480s。
- 2026-06-10：仓库已推送 GitHub（`github.com/Joe7921/Novoscan-Cloud`,默认分支 `main`）;git 身份改为 `Joe7921 <zhouhaoyu6666@gmail.com>`,历史两次提交作者已改写。
- 2026-06-10：阶段 2 决策——① 建表方式=用户提供 Supabase 连接凭据,我连库建表并验证（非让用户手动跑 SQL）;② pgvector 向量维度=**1536**（兼容 OpenAI text-embedding-3-small,一旦建表固定,改维度需迁移）。
- 2026-06-10：记忆表由旧库纯 tsvector 升级为 **tsvector + pgvector 双检索**;旧表名 `agent_experiences` → 新表名 `agent_memory`。
- 2026-06-10：Supabase 项目=`tmemhecjmlxdpwolltlv`(首尔 `ap-northeast-2`)。本机无 IPv6,**Direct 直连不可用**,数据库脚本固定走 **Session pooler**(`aws-1-ap-northeast-2.pooler.supabase.com:5432`,user=`postgres.<ref>`)。`.env.local` 已配 URL/publishable/secret/DATABASE_URL(均本地,git 忽略)。
- 2026-06-10：技术坑记录——`createClient<Database>` 的 `Database` 类型里,表的 `Row`/`Insert` **必须用 `type` 而非 `interface`**(interface 不满足 supabase-js 要求的隐式索引签名,否则 upsert/insert 入参被推断成 `never`)。故 `db.ts` 四个表类型用 `type`。
- 2026-06-11：模型分档(`callByTier`)——fast=`deepseek-chat`(非思考:关键词/翻译/引擎选择/重排)、standard=`deepseek-v4-pro`(分析)、strong=中转站 Claude(辩论/仲裁)。**关键坑**:DeepSeek V4(flash/pro)是思考模型,小输出时 reasoning 吃光正文 → 简单活必须用非思考模型。
- 2026-06-11：GIGO 修复——GitHub 改英文关键词搜(中文直搜召回无关高星 repo)+ repos 过证据闸门;产业网页/开源均过相关性过滤。证据闸门(学术/网页/开源)统一在 `rerank.ts`。
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
