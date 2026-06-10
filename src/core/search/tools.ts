// 把检索能力封装为 EngineTool 并注册(数据源工具)。
// 固定管线现在按 id 调用;将来 Agentic 模式可把它当工具交给主控 AI。

import { z } from "zod";
import type { AcademicResult } from "@/lib/types";
import { registerTool, type EngineTool } from "@/core/tools";
import { searchAcademic } from "./academic-aggregate";

const academicInputSchema = z.object({
  query: z.string().describe("用户的创意 / 研究主题"),
  fromYear: z.number().optional().describe("起始年份(默认 2020)"),
  topK: z.number().optional().describe("证据闸门后保留的高相关论文数(默认 20)"),
});
type AcademicInput = z.infer<typeof academicInputSchema>;

export const academicSearchTool: EngineTool<AcademicInput, AcademicResult> = {
  id: "search.academic",
  category: "datasource",
  title: { zh: "学术检索", en: "Academic Search" },
  description:
    "检索学术论文(OpenAlex / arXiv / CrossRef / CORE 四源聚合 + 相关性重排过滤),返回与创意高相关的论文集合及统计。输入创意主题。",
  inputSchema: academicInputSchema,
  execute: (input, ctx) =>
    searchAcademic(input.query, {
      fromYear: input.fromYear,
      topK: input.topK,
      onProgress: ctx.onProgress,
    }),
};

registerTool(academicSearchTool);
