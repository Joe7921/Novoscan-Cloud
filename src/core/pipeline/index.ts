// 管线统一出口。导入本模块即注册内置管线(副作用)。

import "./pipelines/novoscan-default";

export * from "./types";
export * from "./registry";
export * from "./define";
export { novoscanDefaultPipeline } from "./pipelines/novoscan-default";
