// 基础通用类型(数据契约地基)
// 参考旧库 src/types.ts 重写,适配新架构。

/** 界面语言 */
export type Language = "zh" | "en";

/**
 * 模型提供商标识。
 * 阶段 3 接入 Vercel AI SDK 时,具体提供商在 core/ai-client 配置;
 * 这里只定义数据契约用到的标识,后续可扩展。
 */
export type ModelProvider = "deepseek" | "minimax" | "moonshot";

/** 分析深度模式。本期仅 standard(标准深度),flash 预留。 */
export type ScanMode = "standard" | "flash";

/** 置信度等级(贯穿各 Agent 输出与可信度评估) */
export type ConfidenceLevel = "high" | "medium" | "low";

/** 支持强度(学术/产业对创意的支撑力度) */
export type SupportStrength = "strong" | "moderate" | "weak";

/** 双语文案 */
export interface LocalizedText {
  zh: string;
  en: string;
}
