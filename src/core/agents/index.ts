// Agents 统一出口。导入本模块即完成注册(副作用):
// - 真子 Agent 注册为 EngineTool(category=agent),管线经 toolRef 引用(阶段 5 起的主路径)
// - 占位 stub 仍注册在 Agent 注册表(agentRef 旧路径),供无 Key 的结构性 smoke 测试使用

import "./stubs";
import "./academic-reviewer";
import "./industry-analyst";
import "./competitor-detective";
import "./cross-domain-scout";
import "./innovation-evaluator";
import "./debater";
import "./arbitrator";
import "./quality-guard";

export * from "./types";
export * from "./registry";
export { RECOMMENDATION_THRESHOLDS, mapScoreToRecommendation } from "./shared";
