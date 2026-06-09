# 技术栈与选型理由（TECH-STACK）

> 本次对话逐项敲定，已全部确认。每项附决策理由，便于接力者理解"为什么"。

## 全套选型

| 层 | 选型 | 决策要点 / 理由 |
|---|---|---|
| **形态** | 网页应用（Next.js 14 App Router + React 18 + TypeScript） | 免安装、与旧库同栈便于对照、前后端一体部署简单 |
| **引擎运行基座** | **混合**：托管调度起步 + 引擎写成可整体搬走的纯 TS 包 | Flip 批量 / Agentic 长循环超出网页"5 分钟"限制；"按自建标准设计、按托管方式部署"→ 起步轻、未来可无痛平移到独立服务、几乎零赌错 |
| **编排逻辑** | **混合**：编排骨架/辩论/仲裁/管线体系**自研**（参考旧库）；模型调用用 **Vercel AI SDK**；持久化/重试靠调度服务；LangGraph.js 仅 Agentic 层可选 | 框架只给"管道"不给"配方"；命脉（辩论/仲裁/管线）自研攥牢、通用苦工（调模型/流式/结构化输出）外包、避开 LangChain 生态频繁大改的锁定 |
| **调度服务** | **Inngest**（备选 Trigger.dev） | 专为 AI 工作流/批量扇出设计、TS 原生、有免费额度、可自托管避免锁定 |
| **数据库 / 记忆** | **Supabase + pgvector**，向量检索包在接口后可换 | 向量"按意思回忆"+ 全文检索一个库搞定；早中期最优、少养系统、不锁死 |
| **前端·组件** | **shadcn/ui**（Radix + Tailwind，复制即拥有代码） | 简洁可定制、**代码自有零锁定**、契合 Claude Desktop 审美；外观仍由用户把关 |
| **前端·状态** | **Zustand**（轻量全局）+ **TanStack Query**（服务端数据/缓存） | 治旧库 props 地狱；流式进度好管 |
| **样式** | Tailwind CSS | 与旧库一致 |
| **富输入·文档** | unpdf(PDF) / mammoth(Word) | 本地解析省钱；扫描件 OCR 后期再加 |
| **富输入·网页** | **Jina Reader**（贴链接返回正文） | 免自写爬虫与正文提取 |
| **账号**（后期） | Supabase Auth | 与平台同源，免登录起步，后加邮箱/Google/微信 |
| **支付**（后期） | **Lemonsqueezy**（备选 Stripe） | 作商户代理帮处理全球税务，个人/小团队最省心 |
| **部署** | Vercel（网页）+ Supabase（数据）+ Inngest（调度） | 全托管、零运维起步 |
| **测试 / 监控** | Vitest（旧库同款）+ Sentry（后期） | 业界标准、够用 |

## 关键决策的"为什么"（速记）

- **为什么混合运行基座**：批量(Flip)和自主循环(Agentic)是早期优先级，会超时；但一上来自建服务器对非技术用户负担太重。混合 = 现在快 + 未来不锁死，且严守"引擎与界面分离"铁律，搬迁无痛。
- **为什么编排自研**：多专家辩论/加权仲裁/可信透明/管线热插拔是产品命脉与差异化，不能交给框架黑盒；旧库已有打磨过的实现可参考重写。
- **为什么 Supabase + pgvector 不上专用向量库**：早中期一个库全搞定最省心；记忆涨到百万级再换不迟，已包接口。
- **为什么 shadcn 不用 MUI/Ant**：重型库自带浓重风格、难改成简洁、有设计语言绑定；shadcn 代码归自己、零锁定、契合 Claude 审美。

## 落地映射（第一层用到）

- `core/ai-client/` = Vercel AI SDK + 旧库的信号量/降级/熔断/Key池策略层
- `core/orchestrator/` + `core/agents/` + `core/pipeline/` = 自研（参考旧库 orchestrator/agents/types）
- `core/search/` = 双轨检索（参考旧库 server/academic、industry、search）
- `core/memory/` = pgvector RAG（升级旧库 agent_experiences）
- `core/ingest/` = unpdf/mammoth/Jina（阶段 8）
- 前端 = Next.js + shadcn/ui + Zustand + TanStack Query
- 调度 = Inngest（阶段 6 预留接入点，Flip 阶段正式启用）
