// 工具层统一出口。

export * from "./types";
export * from "./registry";
export * from "./ai-sdk-adapter";

// 内置 utility 工具:导入即注册(副作用)。
import "./vision-tool";
export { visionTool, type VisionToolOutput } from "./vision-tool";
