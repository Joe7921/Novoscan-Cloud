// 图片"理解桥":用多模态模型(默认中转站 Claude)把图片深度读成富文字,
// 再喂给下游纯文本管线/Agentic 模式。桥做"厚"——一次榨干:整体说明 + 文字(OCR)
// + 图表/数据 + 结构/布局 + 关键细节,尽量让下游无需再回看原图。

import { callVision, type VisionImage } from "@/core/ai-client";
import { INGEST_LIMITS, IngestError } from "./types";

const VISION_EXTRACT_PROMPT = `你是图片内容提取专家。下面是用户在做创新/可信度分析时附带的一张图片(可能是产品原型、技术架构图、数据图表、流程图、截图或扫描文档)。

请把这张图里**所有对分析有价值的信息**完整、客观地转写成结构化中文文字,供后续文本模型使用。严格只描述图中真实存在的内容,**不要臆测或编造**。按以下结构输出:

【整体说明】这是什么图、主题是什么。
【文字内容】逐字转写图中出现的所有文字(标题、标签、注释、表格文本等);无文字则写"无"。
【图表/数据】若是图表:坐标轴/图例/各数据点或趋势的数值;若是表格:转成文字表格。无则写"无"。
【结构/布局】组件、模块、流程节点及它们之间的连接/层级关系。
【关键细节】对判断创新性/可行性有意义的细节(技术选型、指标、UI 要素等)。

只输出上述转写内容,不要加你自己的评价或分析。`;

/** 用 vision 模型把图片转成富文字。 */
export async function parseImage(
  bytes: Uint8Array,
  mediaType: string,
  signal?: AbortSignal,
): Promise<string> {
  const image: VisionImage = { data: bytes, mediaType };
  try {
    const res = await callVision({
      prompt: VISION_EXTRACT_PROMPT,
      images: [image],
      maxOutputTokens: 8_192,
      timeoutMs: INGEST_LIMITS.imageTimeoutMs,
      abortSignal: signal,
    });
    const text = res.text.trim();
    if (!text) throw new IngestError("图片理解返回空内容", "upstream");
    return text;
  } catch (err) {
    if (err instanceof IngestError) throw err;
    if ((err as Error)?.name === "AbortError") throw err;
    throw new IngestError(
      `图片理解失败:${err instanceof Error ? err.message : String(err)}`,
      "upstream",
    );
  }
}
