# 执行计划（PLAN）

> 配合 `REFACTOR-PRD.md`（定位/范围）、`ARCHITECTURE.md`（架构）、`TECH-STACK.md`（技术选型）使用。
> 进度实时记录在 `PROGRESS.md`。新 session 开局先读 `PROGRESS.md` 再读本文件。

## A. 长远路线图（盖楼顺序）

终极形态见 `ARCHITECTURE.md`（线上办公楼 5 楼层）。施工顺序（已与用户确认）：

1. **引擎 + Playground 首条管线**（免登录可试）← **本期第一层，下方 B 部分**
2. **Flip** + 所需地基（账号 + 任务队列 + 基础计费）+ 批量闭环 ← 提前（投资人批量=早期付费点）
3. **Agentic Mode**（中心 ReAct 智能体自主组管线）
4. **更多预置管线**（Bizscan 等旧产品线迁为管线）
5. **Studio + Marketplace**（创作生态，最重、最后）
- **Project Base**：灵活插入（与 2–4 并行或更后，看资源）

**4 条设计铁律**（贯穿全程，第一行代码就守）：①管线是一等公民（可声明/版本化/热插拔）②引擎与界面分离（纯 TS 包，可无界面/批量调用）③分析核心无状态、状态单独一层 ④插件契约与沙箱早立规矩。详见 `ARCHITECTURE.md`。

---

## B. 第一层施工计划（近期实际动工）

**目标**：跑通"管线引擎 + Playground 第一条管线（= 核心可信分析闭环）"，**从第一天就建在引擎/管线抽象上**（v1 内置 1 条管线即可），免登录可试。

### 工程结构

```
src/
  app/
    layout.tsx          ← 全局：Claude Desktop 式左侧板块导航 + 主区域
    page.tsx            ← 默认进入 Playground（创新分析板块）
    report/[id]/        ← 报告页（可分享）
    api/analyze/        ← 交互式分析接口（SSE 流式）
  core/                 ← 引擎：纯净、与界面/平台解耦的 TS 包（铁律②）
    pipeline/           ← 管线定义与注册（热插拔接口，铁律①）
    orchestrator/       ← 分层调度 L1→L4（自研，参考旧库）
    agents/             ← 学术/产业/竞品/创新/跨域/仲裁/质检
    ai-client/          ← Vercel AI SDK 封装 + 信号量/降级/熔断/Key池 策略层
    search/             ← 双轨检索 academic/ + industry/
    memory/             ← 记忆沉淀与 RAG 检索（接口后接 pgvector）
    ingest/             ← 富输入：文档/链接 → 文字
  components/
    shell/              ← 分板块外壳（导航+主区域容器，shadcn 风格）
    boards/analysis/    ← 创新分析板块：输入/分析中/报告 三态
    report/             ← 单一报告渲染引擎（雷达/评分/证据/透明化）
    ui/                 ← shadcn/ui 基础组件
  lib/
    supabase/  i18n/  store/(Zustand)  query/(TanStack)  types/
docs/                   ← 本套文档
```

### 阶段（第一层内部）

| # | 阶段 | 产出 | 验收 |
|---|---|---|---|
| 1 | 骨架+外壳 | Next.js+TS+Tailwind+shadcn 初始化；Claude Desktop 式左侧板块（仅激活 Playground，余占位）+主区域；i18n 中英；Zustand/TanStack 接入；Supabase 接通 | `npm run dev` 见分板块外壳，中英可切 |
| 2 | 数据契约+记忆地基 | `lib/types` 核心类型；Supabase 建 `search_history`(缓存)+记忆表(pgvector 骨架) | 类型编译过；表可读写 |
| 3 | 引擎骨架 | `core/pipeline` 管线接口+注册；`core/orchestrator` 分层骨架；`core/ai-client`(Vercel AI SDK + 信号量/降级/熔断) | 脚本能调通模型、跑通空管线 |
| 4 | 双轨检索 | `core/search`：学术四源+产业多源，聚合去重+关键词+引擎选择 | 给关键词返回聚合结果 |
| 5 | 第一条管线 | `core/agents` 各 Agent；L1(2/3 Majority/错开/模型分散)→L2→L2.5辩论(差>15)→L3仲裁(加权透明)→L4质检；时间预算+心跳+isFallback | 给定检索结果产出完整可信报告 |
| 6 | analyze 接口 | `api/analyze`：检索→引擎→SSE(progress/agent_state/agent_thinking)；写缓存+记忆沉淀；预留 Inngest 接入点 | 前端/curl 收到流式事件并拿到报告 |
| 7 | 分析板块前端 | 输入态(长文)/分析中态(进度+Agent卡+打字机)/报告态(评分+结论·6维雷达·关键发现·红旗·**相似论文可点溯源**·证据·**仲裁加权透明**·**辩论/异议/不确定性**·原始数据) | 三态顺畅，各模块正确呈现 |
| 8 | 富输入 | `core/ingest`：unpdf/mammoth 文档 + Jina Reader 网页 → 文字；输入区支持贴文档/链接 | 上传 PDF 或贴链接能转为输入并跑通 |
| 9 | 缓存+容错+联调 | 缓存命中标注+刷新重生成；isPartial/降级透明；超时返回部分结果不白屏；记忆沉淀验证；端到端验收 | 按下方"验证"逐条通过 |

### 验证（第一层端到端）
1. 打开网址见 Playground 分板块外壳，中英可切。
2. 贴入创意/长文提交，看到实时分析进度（多 Agent 状态 + 打字机思考）。
3. 得到完整可信报告：评分+结论、6 维雷达、关键发现、相似论文(可点)、证据、仲裁加权透明、辩论/异议/不确定性、原始数据。
4. 相同创意短期重查命中缓存并标注 + "刷新重生成"。
5. 任一 Agent 超时：标"部分结果/低置信"，不崩。
6. 上传 PDF 或贴链接能解析为输入并跑通。
7. 结果沉淀进记忆表，下次相关查询能被 RAG 检索到。

### 复用旧库（参考重写，不复制）
- 编排：旧 `src/agents/orchestrator.ts`、`flashOrchestrator.ts`
- AI 客户端策略：旧 `src/lib/ai-client.ts`（信号量/降级/退避/熔断/Key池）→ 调用层用 Vercel AI SDK 重写、保留策略
- 检索：旧 `src/server/academic/*`、`industry/*`、`search/*`
- 记忆：旧 `agent_experiences`（升级 pgvector）
- 类型：旧 `src/types.ts`、`src/agents/types.ts`
- 全部事实见 `docs/OLD-CODEBASE-ANALYSIS.md`
