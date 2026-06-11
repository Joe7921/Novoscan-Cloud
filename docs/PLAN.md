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
| 5 ✅ | 第一条管线 | `core/agents` 各 Agent(EngineTool)；L1(2/3 Majority/错开/模型分散)→L2→L2.5辩论(差>15)→L3仲裁(加权透明)→L4质检；时间预算+心跳+isFallback | ✅ 真实 AI 端到端 6/6 通过(smoke-agents.ts) |
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

---

## C. 阶段 3 详细设计（引擎骨架 / 产品的"心脏"）

> 2026-06-10 敲定。目标:搭好引擎三大件,能真打通模型 + 按"配方"跑通完整分层流程(本阶段 Agent 用占位 stub,真 Agent 阶段 5)。骨架做**完整版**。

### C.1 模型分工(混合;每个 step 可单独指定 provider/model)
| 层 | Agent | 模型 | 说明 |
|---|---|---|---|
| L1 并行 | 学术/产业/竞品/跨域 | 国产三家(分散) | 量大、成本敏感;沿用旧库三模型分散策略 |
| L2 | 创新评估师 | 国产 | 交叉质疑前三份,产出 6 维雷达 |
| L2.5 | 辩论裁判 | **Sonnet 4.6** | 评分差>15 触发对抗辩论,推理质量关键 |
| L3 | 仲裁员 | **Sonnet 4.6** | 加权仲裁=结论可信度核心 |
| L4 | 质检 | 无 AI | 纯逻辑一致性检查 |

- 国产三家:DeepSeek / Minimax / Moonshot,经 `@ai-sdk/openai-compatible` 接入。
- Claude(Sonnet 4.6 `claude-sonnet-4-6`):经 **`@ai-sdk/anthropic`** 官方 provider(非套壳),复杂推理用 **adaptive thinking**。
- 调用统一走 **Vercel AI SDK**,策略层(降级/熔断/Key池/退避)自研。

### C.2 首条管线 = Novoscan 默认管线(通用型)
- `id: "novoscan-default"`,`type: "通用型"`,名「Novoscan 默认管线」。
- 平台开箱即用的通用分析管线;将来 Studio/市场的自制管线、行业定制管线都在它之外新增。
- 它是 **Agentic Mode(施工第 3 步)的地基**:Agentic = 中心 ReAct 智能体自主"生成配方",前提是管线即可声明/热插拔的数据(铁律①)。

### C.3 文件结构(`src/core/`)
```
core/
  ai-client/   config.ts(常量集中) provider-registry.ts key-pool.ts
               circuit-breaker.ts semaphore.ts parse.ts call.ts index.ts
  agents/      types.ts(AgentDefinition 契约) registry.ts stubs.ts index.ts
  pipeline/    types.ts registry.ts define.ts pipelines/novoscan-default.ts index.ts
  orchestrator/ budget.ts timeout.ts orchestrator.ts index.ts
```

### C.4 ai-client 策略(参考旧库 1268 行重写,保留以下机制)
- **降级链**:首选 70% 时间预算,备选平分剩余;限流/超时跳过重试直接降级。
- **Key 池**:按 provider 多 Key,挑最空闲;acquire/release/markSuccess/markFailure。
- **熔断**:连续失败 2 次 → 5min 冷却 → 半开探测(`providerCircuitMap`)。
- **退避**:429/503 读 Retry-After,上限 2s,同模型最多重试 1 次。
- **并发信号量**:high(主)/low(后台)两级。
- **超时/中断**:单次 30s 默认、外部 AbortSignal 转发、流式空闲超时(min(60s,max(10s,80%)))。
- **JSON 自愈解析**:```json 块 → 直解 → 花括号平衡 → 截断补全(四级)。
- **成本限制**:本阶段留接口占位(`checkCostLimit`),后期接 Supabase 计量。

### C.5 pipeline 契约(铁律①,旧库无对应、新增)
- `PipelineDefinition`:id/version/name(双语)/type/description/layers[]/scoring(权重)/report(渲染配置)/plugins(沙箱接口雏形)。
- `PipelineLayer`:id/mode(parallel|serial)/steps[]/majority?(2/3 早进)。
- `PipelineStep`:id/agentRef/model?(provider+model 覆盖)/critical?(关键路径)/condition?(如 L2.5 辩论触发)。
- `registry`:register/get/list(热插拔);`definePipeline` 辅助。

### C.6 orchestrator(参考旧库 734 行重写为通用调度器,不写死 Agent)
- 读 `PipelineDefinition` 按层跑;保留:2/3 多数即进(仅算非 fallback)、关键路径 vs 后台并行、condition 触发、时间预算分配(总 300s)、心跳进度、`onProgress`(progress/log/agent_state/agent_thinking)、降级不崩(超时标"部分结果")。
- 辅助:`runWithTimeout`、时间预算 `budget`。

### C.7 agents(本阶段占位)
- `AgentDefinition`:`{ id; run(input, ctx): Promise<AgentOutput> }`;`registry` 注册表。
- `stubs.ts`:各角色返回结构完整的假 `AgentOutput`(标 `isStub`),供空管线端到端跑通。真 Agent 阶段 5。

### C.8 验收
1. **调通模型**:`scripts/smoke-ai.mjs` 真打国产 + Claude 各一次,拿到回复。
2. **跑通空管线**:`scripts/smoke-pipeline.mjs` 用 stub agents 跑完 `novoscan-default` 整条管线,产出结构完整的 `FinalReport`。
3. `npx tsc --noEmit` 通过。

---

## D. 工具层统一契约(双轨地基,2026-06-10)

决策:Agentic 采用「**双轨并存 + 工具层统一**」(非替换固定管线)。详见 `ARCHITECTURE.md` 「双轨执行与工具层」。

**已建 `core/tools/`:**
- `types.ts`:`EngineTool<I,O>`(id/category/title/description/inputSchema(zod)/execute)、`ToolContext`、`AnyEngineTool`。
- `registry.ts`:工具注册表(register/get/list/byCategory,热插拔)。
- `ai-sdk-adapter.ts`:`toAISDKTool`/`toAISDKToolSet` —— EngineTool → Vercel AI SDK tool(供 Agentic 第3步复用)。

**对阶段 4/5 的调整:**
- 阶段 4:检索源实现为 `EngineTool`(category=`datasource`)并注册;聚合/引擎选择照旧。
- 阶段 5:真子 Agent 实现为 `EngineTool`(category=`agent`),替换阶段 3 占位 stub;管线 step 由"引用 agentRef"升级为"引用 toolId + 入参映射(从 results 构造 input)",orchestrator 相应小改。
- 阶段 3 占位 stub 暂留,阶段 5 平滑迁移,不返工已验证部分。
- Agentic 模式(施工第 3 步)直接复用工具表 + 适配器,届时加中心 ReAct 智能体。

---

## E. 阶段 5 详细设计(第一条管线·真子 Agent,2026-06-11 敲定,方向 A:完整做)

> 目标:把 8 个占位 stub 全部换成真 Agent,给定真实双轨检索结果,跑完 `novoscan-default` 整条管线,产出第一份**完整可信报告**(含辩论与加权仲裁透明)。本阶段纯引擎层,不碰前端;网页接口与页面在阶段 6/7。
>
> **状态:已实施完成并合并**(2026-06-11,云端会话分支 `ca93386` 并入 main)。下文为设计稿,与实际实现的差异已就地修订标注;实测验收与踩坑见 `PROGRESS.md`。

### E.1 总体原则
- **延续治 GIGO**:每个 Agent 的 Prompt 注入"带编号的证据清单"(由阶段 4 闸门后的检索结果格式化而来),要求结论必须引用证据编号;`evidenceSources` 只能来自给定证据,降低幻觉。
- **模型分档复用 `callByTier`**:L1/L2 用 standard(`deepseek-v4-pro`),L2.5 辩论 + L3 仲裁用 strong(中转站 Claude),证据格式化/小整理活用 fast(非思考)。管线里 minimax/moonshot 声明保留,无 key 时由降级链自动落回 DeepSeek(已验证机制)。
- **JSON 结构化输出**:Prompt 给出严格 JSON schema 示例 + `parse.ts` 四级自愈解析 + 字段兜底(缺字段填默认值并降置信),任何一步解析失败返回 `isFallback` 输出,**不崩管线**。
- **双语**:Prompt 按 `input.language` 指定输出语言(报告正文跟用户语言走)。
- **参考旧库重写**:旧 `src/agents/` 各角色的 Prompt 思路与评分口径仅作参考,在新工作区按新契约重写,不复制。
- **省钱开关**:smoke 脚本支持 `--cheap` 把全部档位压到 fast,供反复调试;正式验收用正常档位跑。

### E.2 工具化迁移(衔接 D 部分;按实施修订)
1. `core/agents/shared.ts` 收口公共辅助(证据/文本截断、输出归一化、推荐等级阈值、语言指令、领域块)。
2. 每个真 Agent 实现为 `EngineTool`(category=`agent`)注册进工具表——管线与 Agentic(第 3 步)共享同一套工具。
3. **(实施比设计更进一步)**`PipelineStep` 增 `toolRef + mapInput`(入参从前序结果显式映射),orchestrator 走工具执行路径;`novoscan-default` 全部 step 已切换 `toolRef`。`agentRef` 保留兼容阶段 3 stub(`smoke-pipeline.ts` 无 Key 结构性冒烟仍可跑)。

### E.3 八个 Agent 的职责与要点
| Agent | 层/模型档 | 输入 | 输出要点 |
|---|---|---|---|
| 学术审查员 `academic` | L1·standard | query + 学术证据清单 | 学术新颖性分析、score、`similarPapers`(相似度+核心差异+可点 URL) |
| 产业分析员 `industry` | L1·standard | query + 产业网页证据 | 市场/落地分析、score、关键发现/红旗 |
| 竞品侦探 `competitor` | L1·standard | query + 开源 repo + 网页证据 | 竞品格局、同类产品点名、差异化空间、score |
| 跨域侦察兵 `crossDomain` | L1 后台·standard | query + 双轨摘要 | `bridges`(跨域迁移桥)+ 知识图谱 + `transferSummary`;非关键,失败不阻塞 |
| 创新评估师 `innovation` | L2·standard | query + L1 三份输出 | 交叉质疑 + 六维雷达 `innovationRadar`(逐维 reasoning)+ score |
| 辩论裁判 `debate` | L2.5·裁判 strong/攻防 fast | 分歧双方输出 | 条件触发(分差>15):多轮真对抗(攻防短输出走 fast 非思考档,防 reasoning 吃光正文;裁判走 strong)+ 收敛检测 + `dissentReport` 异议保留;`isFallback` 降级 Agent 不参与辩论(防逼模型编证据) |
| 仲裁员 `arbitration` | L3·strong | 全部前序输出 | 加权评分透明(`weightedBreakdown` 按管线 scoring 权重)、总分、结论、`nextSteps`、共识度、异议 |
| 质检 `quality` | L4·无 AI | FinalReport 雏形 | 纯逻辑:评分-结论一致性、加权和≈总分、必填字段齐全、证据引用编号有效;产出 warnings/corrections |

### E.4 实施要点(按实施修订)
- 仲裁加权明细(`weightedBreakdown`)由**代码预计算后回填**,模型只输出 summary/score/裁决文本——防模型自报数字算错,保证透明数据准确。
- 创新评估师带"防退化重试"(六维雷达全同分视为退化);跨域侦察兵为后台非关键,失败不阻塞。
- **超时校准(实测)**:思考模型大 prompt+16K 输出单次 90-110s 属常态;`agentMs` 70→120s、`arbitratorMs` 95→150s、总预算 300→480s,学术/跨域单 step 放宽 200s。

### E.5 验收结果(2026-06-11 实测)
1. ✅ `npx tsx scripts/smoke-agents.ts` 真实 AI 端到端 **6/6 通过**:四核心 Agent 真实完成(学术 65/产业 30/竞品 85/创新 28,独立评分)、六维雷达非退化、辩论真实触发 3 轮、仲裁产出「谨慎考虑 42 分」、质检 passed=true,全程无 `isStub`。
2. ✅ `npx tsc --noEmit` 通过;`smoke-pipeline.ts` 改为 stub 克隆管线只验结构(无 Key 可跑)。
3. ⚠️ 已知待优化(阶段 6 前):跨域侦察兵(输出最大)偶发 JSON 截断解析失败,需提高其 `maxOutputTokens` 或拆分输出;CLI 跑脚本须清除 shell 预置的 `ANTHROPIC_*` 环境变量(详见 PROGRESS 决策记录)。
