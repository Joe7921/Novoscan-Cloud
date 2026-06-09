# 接力文档（HANDOFF）—— 新对话从这里开始

> 这是给「接手本项目的新智能体 / 新会话」的入口文档。读完本页即可上手。

## 这是什么项目

在本工作区 `D:\Antigravity projects\Novoscan Cloud` **全栈重写**旧产品 `novoscan-next`（旧库**只读、禁改**，位于 `D:\Antigravity projects\novoscan-next`）。

一句话定位：面向**专业人群**（创业者/PM、科研/技术、投资/分析师）的**「尽调级」创新分析平台**——贴入想法/长文/文档/链接 → 双轨检索 + 多 AI 专家深度分析（辩论/仲裁/质检）→ 产出**经得起追问的可信报告**。**可信度优先**，**Claude Desktop 式分板块**界面，中英双语，沿用 Novoscan，本期免登录。

## 当前进度（截至本次对话）

- ✅ 工作区已初始化：`.claude/settings.json`、`CLAUDE.md`、`docs/`、`git`（首次提交 `3577c2b`）。
- ✅ 旧库已通读 → `docs/OLD-CODEBASE-ANALYSIS.md`（事实基础）。
- ✅ 已敲定：产品定位、终极形态（5 楼层）、整体架构、全套技术栈、施工顺序。
- ❌ **尚未写任何业务代码**；工程未初始化（还没 package.json）。
- 🔜 下一步 = 第一层「阶段 1：工程骨架 + Claude Desktop 式外壳」。

## 阅读顺序（建议）

1. **本文件**（全局速览）
2. `docs/REFACTOR-PRD.md` —— 产品定位、5 楼层愿景、本期范围、已确认决策
3. `docs/ARCHITECTURE.md` —— 大楼架构剖面 + 4 条设计铁律
4. `docs/TECH-STACK.md` —— 全套技术选型 + 每项决策理由
5. `docs/PLAN.md` —— 长远路线图 + 第一层九阶段施工计划
6. `docs/PROGRESS.md` —— 实时进度（每推进一步必更新）
7. `docs/OLD-CODEBASE-ANALYSIS.md` —— 旧库详尽分析（重写时对照参考）

## 用户须知（重要）

- 用户是**非技术背景**：用简体中文、大白话沟通，避免术语；每个关键决策**先问、不擅自脑补**；给宏观方向时先给 2 个细化方向供其选择。
- **红线**：未授权不得改视觉外观/CSS/UI 组件库配置；不可逆操作（删文件/强推 Git/改部署）先确认。
- 旧库**绝对禁止修改**，只读参考、重写而非复制粘贴。

## 立即可做的下一步

按 `docs/PLAN.md` 第一层 **阶段 1**：初始化 Next.js 14 + TS + Tailwind + shadcn/ui 工程，搭 Claude Desktop 式左侧板块外壳 + i18n + 接通 Supabase。初始化会触发一次 `npm install`，需用户授权放行。
