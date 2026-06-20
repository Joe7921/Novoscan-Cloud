// 图片理解工具(category=utility):把"看图"封装成统一 EngineTool,
// 供将来 Agentic 模式按需"主动看图"(某 Agent 中途要看架构图/原型图时调用)。
// 与入口"理解桥"(core/ingest/image.ts)共用 ai-client 的 callVision —— 同一能力,两处复用。

import { z } from "zod";
import { callVision } from "@/core/ai-client";
import { registerTool } from "./registry";
import type { EngineTool } from "./types";

const imageSchema = z.object({
  /** base64 编码的图片数据(不含 data: 前缀) */
  data: z.string().min(1).describe("base64 编码的图片数据"),
  /** MIME 类型,如 image/png、image/jpeg */
  mediaType: z
    .string()
    .regex(/^image\/(png|jpe?g|webp|gif)$/i)
    .describe("图片 MIME 类型"),
});

const inputSchema = z.object({
  images: z.array(imageSchema).min(1).max(8).describe("要理解的图片(base64),最多 8 张"),
  instruction: z
    .string()
    .default("请客观、完整地描述这张图的内容,包括其中的文字、图表数据与结构关系。")
    .describe("要让模型针对图片回答/提取什么"),
});
type Input = z.infer<typeof inputSchema>;

export interface VisionToolOutput {
  text: string;
  model: string;
}

export const visionTool: EngineTool<Input, VisionToolOutput> = {
  id: "vision.understand",
  category: "utility",
  title: { zh: "图片理解", en: "Image Understanding" },
  description:
    "用多模态模型理解图片(产品原型、架构图、数据图表、截图、扫描件等):转写文字、读取图表数据、说明结构。输入一张或多张图片(base64)+ 想问的内容,返回文字理解结果。",
  inputSchema,
  async execute(input, ctx) {
    const res = await callVision({
      prompt: input.instruction,
      images: input.images.map((img) => ({ data: img.data, mediaType: img.mediaType })),
      maxOutputTokens: 8_192,
      abortSignal: ctx.abortSignal,
    });
    return { text: res.text.trim(), model: res.usedModel };
  },
};

registerTool(visionTool);
