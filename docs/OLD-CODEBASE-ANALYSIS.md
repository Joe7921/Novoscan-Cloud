# 旧代码库分析（novoscan-next）

> 本文档是对只读旧代码库 `D:\Antigravity projects\novoscan-next` 的通读调研结果，作为编写重构 PRD 的事实基础。
> 调研日期：2026-06-09。所有路径均为旧库内相对/绝对路径，**旧库只读，禁止修改**。

## 0. 一句话定位

Novoscan-Next 是一个 **多智能体 AI 创新评估 SaaS 平台**：用户输入一个创意/想法，系统通过「双轨检索（学术四源 + 产业六源）」+「多 Agent 并行分析 + 仲裁 + 质检」产出带多维雷达图的创新性评估报告。围绕核心分析能力，扩展出 Bizscan（商业可行性）、Matchscan（赛事/原型匹配）、Clawscan/skill-check（IP 查新）、NovoMind（创新人格评测）、NovoDNA（创新基因图谱）、NovoTracker（持续监控护城河）等产品线，并带有用户体系、订阅付费、插件市场、MCP 开放接口。

## 1. 技术栈（实测）

| 层 | 技术 |
|---|---|
| 前端框架 | Next.js 14.2.35（App Router）、React 18 |
| 样式/动画 | Tailwind CSS 3.4、Framer Motion 12、Recharts 3.7、lucide-react、driver.js |
| 状态/本地存储 | React useState + props drilling（无集中 store）、Dexie 4（IndexedDB）、localStorage/sessionStorage |
| 后端 | Next.js Route Handlers（`src/app/api/**`，约 49–87 个端点）、SSE 流式 |
| AI 模型 | DeepSeek（含 R1 reasoning）、Minimax、Moonshot/Kimi（Gemini 为可选）；多模型降级链 + 双层信号量 + Key 池 + 429/503 退避 + 熔断 |
| 外部检索 | 学术：OpenAlex / arXiv / CrossRef / CORE；产业：Brave / SerpAPI / GitHub / 微信公众号，降级 Serper / Tavily / SearXNG |
| 云端数据 | Supabase（PostgreSQL + Auth + RLS），@supabase/ssr |
| WASM | Rust（`rust/novoscan-core`）编译质量评分引擎 + JSON 自愈解析器，产物在 `pkg/`，桥接 `src/lib/wasmBridge.ts`，失败降级 TS 实现 |
| 商业版引擎 | `apps/engine`（Python FastAPI + LangGraph，独立微服务） |
| 包管理/构建 | npm + Turbo（monorepo）；测试 Vitest + pytest；husky + lint-staged |
| 部署 | Vercel（region hkg1），Vercel Cron 4 个定时任务 |
| 第三方 | Lemonsqueezy（付费）、Resend（邮件）、Upstash Redis（限流，可选）、MCP SDK |

## 2. 目录结构（顶层，排除 node_modules/.next/.git）

```
src/                  ← Next.js 主应用（前端 + API）
  app/                ← App Router 页面与 API 路由
    api/              ← 49~87 个 Route Handler
  agents/             ← 多 Agent 核心（orchestrator、各 agent、types）
    bizscan/ clawscan/ matchscan/  ← 各产品线专用 Agent 组
  server/             ← 外部数据源检索（academic/ industry/ search/）
  lib/                ← ai-client、services、db(Dexie)、plugins、pipeline、wasmBridge
  components/         ← 155 个 tsx 组件
  utils/supabase/     ← client/server/middleware 封装
  locales/            ← 中英翻译
  types.ts            ← 全局类型
apps/engine/          ← Python LangGraph 编排引擎（商业版微服务）
apps/frontend-snapshot/
packages/shared-types/← 跨应用共享 TS 类型 @novoscan/shared-types
rust/novoscan-core/   ← Rust WASM 源码
pkg/                  ← WASM 构建产物（node + web 双目标）
admin-cli/            ← 本地管理 CLI（14 命令，直连 Supabase）
supabase/migrations/  ← 23 个迁移文件
sql/                  ← marketplace 等额外建表
scripts/              ← 13 个运维/seed/benchmark 脚本
tests/                ← novoscan / bizscan 测试
docs/                 ← 旧库自带架构/API/部署/demo 文档（已读，价值高）
```

## 3. 前端路由地图（核心）

| 路由 | 文件 | 用途 |
|---|---|---|
| `/` | `src/app/page.tsx` + `HomeClient.tsx` | 首页：创新评估主入口（搜索框 + 模式选择 + 实时 SSE 分析 + 报告） |
| `/report/[id]` | `src/app/report/[id]/page.tsx` | 分析报告详情（可公开分享） |
| `/bizscan` | `src/app/bizscan/page.tsx` | 商业可行性分析（表单→SSE→BII 报告→追问） |
| `/matchscan` `/matchscan/report/[id]` | `src/app/matchscan/**` | 赛事/原型匹配评估 |
| `/skill-check` | `src/app/skill-check/page.tsx` | Clawscan IP 查新（`/clawscan` 重定向至此） |
| `/tracker` | `src/app/tracker/page.tsx` | NovoTracker 监控（dashboard/alerts/moat/history 四标签） |
| `/profile` | `src/app/profile/page.tsx` | 用户中心（信息/偏好/钱包积分/订阅） |
| `/trends` `/casevault` `/marketplace` `/docs` `/business` `/history` `/health` | 各自 page.tsx | 趋势/案例图谱/插件市场/文档/企业版/历史/健康 |
| `/auth/auth-code-error` | — | OAuth 错误页 |

- 全局 `src/app/layout.tsx`（SEO/PWA/i18n），`src/app/error.tsx`（chunk 加载失败自恢复）。
- App 状态机：`INPUT → ANALYZING → REPORT`。

## 4. 后端核心调度（重做客户端必须吃透）

### 4.1 Orchestrator（`src/agents/orchestrator.ts`，~734 行）
分层流水线：
- **Layer1（并行）**：学术审查员 + 产业分析员 + 竞品侦探（关键路径，2/3 Majority 即进 L2）+ 跨域侦察兵（非关键后台）+ 插件 Agent。错开 500ms 启动；3 个 Agent 分散到 3 个不同模型提供商。
- **Layer2**：创新评估师（交叉质疑前三份报告，产出 6 维 innovationRadar）。
- **Layer2.5（条件）**：NovoDebate 对抗辩论，触发条件 = 任意两 Agent 评分差 > 15。
- **Layer3**：仲裁员（动态权重、共识度、少数派异议；可用 DeepSeek R1）。
- **Layer4**：质量把关（纯逻辑一致性检查 + 自动修正；WASM 实现）。
- 总时间预算 300s（Vercel Pro），各层有动态预算 + 心跳防 CDN 断连。
- 流式：内部 `onProgress(event, data)` 回调 → API 路由 `createSSEStream()` 转 SSE。事件类型：`progress / log / agent_state / agent_thinking / agent_memory`。
- Flash 极速模式：`src/agents/flashOrchestrator.ts`（~30s，简化流程）。

### 4.2 AI 客户端（`src/lib/ai-client.ts`，~1268 行）
双层信号量（主并发3 / 低优先级1）+ Key 池轮换 + 成本限制检查 + 模型降级链 + 429/503 退避（解析 Retry-After，上限 ~10s）+ 2 次连续失败熔断（5min 冷却 + 半开探测）+ AbortSignal 深度集成 + 流式空闲超时。关键导出：`callProvider / callAIRaw / callAIWithFallback / callDeepSeekR1 / parseAgentJSON / isProviderAvailable`。

### 4.3 Agent 体系（`src/agents/`）
统一 `AgentOutput`（agentName/analysis/score 0-100/confidence/keyFindings/redFlags/evidenceSources/reasoning/dimensionScores/isFallback/innovationRadar?/similarPapers?）。Prompt 内嵌在各 agent 函数中。
- 主线：academicReviewer / industryAnalyst / competitorDetective / innovationEvaluator / crossDomainScout / arbitrator / qualityGuard。
- 产品线子 Agent 组：`bizscan/`（market-scout、novelty-auditor、feasibility-examiner、competitor-profiler、cross-validator、strategic-arbiter）、`clawscan/`、`matchscan/`。

### 4.4 外部检索（`src/server/`）
- 学术四源 `src/server/academic/*`，聚合 `src/server/search/academic.ts`（并行→去重→Top20）。
- 产业六源 `src/server/industry/*`，聚合 `src/server/search/industry.ts`（一级 Brave+SerpAPI，后台 GitHub+微信，降级 Serper→Tavily→SearXNG）。
- 智能引擎选择 `src/server/search/engine-selector.ts`（AI 决策用哪些引擎）。

## 5. API 端点（分类摘要，全清单见调研原始记录）

- 分析核心：`/api/analyze`（标准）、`/api/search`、`/api/dual-track`、`/api/report`、`/api/innovation-dna`、`/api/agent-retry`。
- 产品线：`/api/bizscan(+/followup)`、`/api/matchscan(+/prototype,/followup)`、`/api/skill-check`、`/api/novomind`。
- 监控/案例：`/api/tracker`(+`[id]`,`/alerts`,`/moat`,`/snapshots`,`/health`)、`/api/casevault`(+ingest/graph/cron)。
- 衍生：`/api/followup`、`/api/cross-recommend`、`/api/idea-polish`、`/api/extract-keywords`、`/api/charge-keyword-extract`、`/api/academic`、`/api/industry`、`/api/trends`、`/api/innovations`。
- 用户/商业：`/api/auth/check-access`、`/api/oauth/*`、`/api/user-access`、`/api/user-preferences`、`/api/subscription`、`/api/wallet(+/redeem)`、`/api/quota`、`/api/cost-usage`、`/api/checkin`、`/api/novocredit/*`、`/api/referral`。
- 报告/同步：`/api/report/[id]`、`/api/report/share`、`/api/report/popular`、`/api/history/[id]`、`/api/sync/*`。
- 平台/运维：`/api/health(+/db,/api-test)`、`/api/platform-stats`、`/api/key-pool/stats`、`/api/admin/*`、`/api/marketplace/*`、`/api/plugin-preferences`、`/api/partner`、`/api/mcp/[transport]`、`/api/webhooks/lemonsqueezy`。
- 鉴权模式：多数核心分析端点 = 需登录 + 配额扣费；部分检索端点 = 仅限速；Cron/admin = CRON_SECRET / 管理员。

## 6. 数据层

### 6.1 Supabase 主要表（migrations 23 个）
- 搜索分析：`search_history`（query/result JSONB/professional_report JSONB，24h 缓存）、`innovations`（创新点库）。
- 用户：`user_profiles`、`user_domain_interests`、`user_search_events`（行为流）。
- 人格：`novomind_assessments`（BARS）、`user_idea_profile`（IDEA 四维 stated/behavior/final + divergence）。
- Agent 记忆：`agent_experiences`（query_hash 去重、search_vector tsvector RAG、lessons_learned）。
- 创新基因：`innovation_dna`（5 维向量 tech_principle/app_scenario/target_user/impl_path/biz_model）。
- 监控：`tracker_monitors` / `tracker_snapshots` / `tracker_alerts`。
- 追问：`followup_sessions`。
- 商业化：`user_subscriptions`（Lemonsqueezy）、`user_checkins`、`user_monthly_usage`、`feature_access`、`redeem_codes`。
- 社区/开放：`public_reports`、`synced_reports`、`marketplace_plugins/plugin_installs/plugin_ratings/user_plugin_preferences`、`mcp_api_keys/mcp_usage_log`、`api_call_logs`、`recommendation_clicks`、`partner_applications`。
- RLS：用户表 `auth.uid() = user_id` 隔离；公开只读表（agent_experiences/innovation_dna/marketplace/public_reports）；后台用 service_role。

### 6.2 Dexie 本地库（`src/lib/db/index.ts`，DB 名 NovoscanDB，v4）
- `searchRecords`、`innovationCache`、`agentExecutions`、`historyReportCache`、`pendingAnalysis`（后台分析任务，含 SSE 进度快照）。
- 会话 ID：`getSessionId()` 存 sessionStorage。

### 6.3 核心类型（`src/types.ts` + `src/agents/types.ts`）
`AnalysisReport`、`DualTrackResult`（academic+industry+crossValidation+credibility）、`AgentInput`、`AgentOutput`、`FinalReport`（聚合各 agent + debate + arbitration + qualityCheck + memoryInsight + pluginAgentOutputs）、`DebateRecord`、`ArbitrationResult`（weightedBreakdown/consensusLevel/dissent）、`InnovationRadarDimension`（6 维）。

## 7. 工程化与配置要点
- 无 `middleware.ts`，认证在 API 路由层（`requireAuth()` in `src/lib/pipeline/`）。
- `vercel.json`：region hkg1；Cron：tracker(日2点)/casevault(日8点)/innovation-dna(周一3点)/trends(日6点)，均需 `?secret=CRON_SECRET`。
- `next.config.js`：CSP/Permissions-Policy/CORS、按需打包、AVIF/WebP、Webpack 启用 asyncWebAssembly、`/clawscan→/skill-check` 重定向、MCP `.well-known` 重写。
- `tsconfig`：`@/* → src/*`；Turbo monorepo；husky + lint-staged。
- MCP：`/api/mcp/[transport]` 暴露 `novoscan_analyze` / `novoscan_status` 工具，OAuth Bearer 鉴权。
- 环境变量：Supabase、各搜索 Key（BRAVE/SERPAPI/CORE/GITHUB）、AI Key（DEEPSEEK/GEMINI…）、学术邮箱、Lemonsqueezy、Upstash、CRON_SECRET、MARKETPLACE_JWT_SECRET、CLOUD_SYNC_*。

## 8. 重做客户端的「热点」逻辑（必须正确处理）
1. **SSE 流式事件**：所有长流程走 SSE，非轮询。需解析 `data:{...}` 并按 event 更新进度条/Agent 卡片/思考气泡，**保留 sourceUrl 溯源**。
2. **isFallback 占位**：L1 可能部分超时返回降级结果，UI 须标记「部分结果/低置信」，不可隐藏。
3. **similarPapers 优先级**：优先用 Agent 语义评估结果，按 similarityScore 排序，authorityLevel 决定样式，点击跳 url。
4. **NovoDebate 触发透明化**：triggered=false 显示原因；true 展示 dissentReport。
5. **Arbitration 权重透明化**：展示 weightedBreakdown（原始分→权重→加权分）、consensusLevel、dissent。
6. **innovationRadar 6 维**：techBreakthrough/appSuitability/competitive/implementable/profitable/sustainable，hover 显示 reasoning。
7. **插件 Agent 注入**：报告末尾展示 pluginAgentOutputs + pluginStats。
8. **关键词确认**：提交前可让用户确认/修改 extractKeywords 结果，回传 confirmedKeywords。
9. **缓存优先**：report 命中缓存标记「来自缓存」+ 提供「刷新重生成」。
10. **功能权限门控**：先查 `/api/user-access`，未授权功能灰显并提示升级。

## 9. 前端复杂度热点（重写风险高→低）
1. 报告渲染引擎（`components/analysis/index.tsx` + `report/adapters/StandardReportAdapter.tsx`，含雷达图/手风琴/原始数据树，存在新旧双版本 feature flag）。
2. 追问精化系统（`lib/followup/useFollowUp.ts` + 4 产品适配器，SSE 状态机 + 报告合并）。
3. analyze 主流程对接（SSE、6 Agent 串联、心跳、降级）。
4. NovoMind 多轮对话（5 状态机、localStorage 2h 过期、打字机、最少 5 轮）。
5. Navbar 文件夹式导航。
中等：Bizscan/Tracker 多状态页、RadarChart SVG。低：表单/认证/工具/首页分段（可较快迁移）。

## 10. 旧库自带文档（高价值，已读）
- `docs/architecture.md`：四层架构 + Agent 时序图 + AI 并发控制 + NovoMind 三代理 + BARS/IDEA 维度表。
- `docs/api.md`：runWorkflow、BaseAgent、NovoMind API、Tracker health、DNA cron。
- `docs/deployment.md`、`docs/demo-script.md`：部署与演示（尚未精读）。
