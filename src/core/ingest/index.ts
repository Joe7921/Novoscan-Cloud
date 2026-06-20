// ingest 统一出口:按来源类型分派解析,统一清洗归一化 + 字数封顶。
// 位于所有模式/管线上游——图片/文档/网页在进引擎前先转成富文字。

import { parseDocx } from "./docx";
import { parseImage } from "./image";
import { parsePdf } from "./pdf";
import { parseWeb } from "./web";
import { INGEST_LIMITS, IngestError, type IngestKind, type IngestResult } from "./types";

export {
  INGEST_LIMITS,
  IngestError,
  type IngestKind,
  type IngestResult,
} from "./types";

const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif)$/i;

/** 上传文件的最小描述(接口从 multipart 取出后传入)。 */
export interface FileInput {
  bytes: Uint8Array;
  filename: string;
  /** 浏览器给的 MIME(可能为空,届时按扩展名兜底) */
  mimeType?: string;
}

/** 解析上传文件(PDF / Word / 图片)。 */
export async function ingestFile(file: FileInput, signal?: AbortSignal): Promise<IngestResult> {
  const kind = detectFileKind(file.filename, file.mimeType);
  const title = file.filename || kindLabel(kind);

  // 大小守卫:图片与文档分别限额。
  const cap = kind === "image" ? INGEST_LIMITS.maxImageBytes : INGEST_LIMITS.maxDocBytes;
  if (file.bytes.byteLength > cap) {
    throw new IngestError(
      `文件过大(${mb(file.bytes.byteLength)}MB),上限 ${mb(cap)}MB`,
      "bad_input",
    );
  }
  if (file.bytes.byteLength === 0) throw new IngestError("文件为空", "bad_input");

  let raw: string;
  let meta: Record<string, string | number> = { bytes: file.bytes.byteLength };
  switch (kind) {
    case "pdf":
      raw = await parsePdf(file.bytes);
      break;
    case "docx":
      raw = await parseDocx(file.bytes);
      break;
    case "image": {
      const mediaType = IMAGE_MIME.test(file.mimeType ?? "")
        ? (file.mimeType as string)
        : guessImageMime(file.filename);
      raw = await parseImage(file.bytes, mediaType, signal);
      meta = { ...meta, mediaType, viaVision: 1 };
      break;
    }
    default:
      throw new IngestError("不支持的文件类型", "bad_input");
  }

  if (!raw.trim()) {
    throw new IngestError(
      kind === "pdf"
        ? "未从 PDF 提取到文字(可能是扫描件/纯图片 PDF,暂不支持 OCR)"
        : "未提取到任何文字内容",
      "bad_input",
    );
  }
  return finalize(kind, title, raw, meta);
}

/** 解析网页链接。 */
export async function ingestUrl(url: string, signal?: AbortSignal): Promise<IngestResult> {
  const { title, text } = await parseWeb(url, signal);
  if (!text.trim()) throw new IngestError("该网页未抓取到正文内容", "bad_input");
  return finalize("web", title, text, { url });
}

// ---- 内部辅助 ----

function detectFileKind(filename: string, mimeType?: string): IngestKind {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  if (IMAGE_MIME.test(mime)) return "image";

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (ext === "doc")
    throw new IngestError("不支持老式 .doc,请另存为 .docx 后上传", "bad_input");
  throw new IngestError(`不支持的文件:.${ext || "(未知)"}(支持 PDF / .docx / 图片)`, "bad_input");
}

function guessImageMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

function kindLabel(kind: IngestKind): string {
  return { pdf: "PDF 文档", docx: "Word 文档", web: "网页", image: "图片" }[kind];
}

// 清洗(去零宽字符 / 归一不间断空格 / 收敛空白)+ 字数封顶,产出最终 IngestResult。
function finalize(
  kind: IngestKind,
  title: string,
  raw: string,
  meta: Record<string, string | number>,
): IngestResult {
  const cleaned = raw
    .replace(/[​-‍﻿]/g, "") // 去零宽字符
    .replace(/ /g, " ") // 不间断空格 → 普通空格
    .replace(/[ \t]+\n/g, "\n") // 行尾空白
    .replace(/\n{3,}/g, "\n\n") // 压缩多余空行
    .trim();
  const truncated = cleaned.length > INGEST_LIMITS.maxChars;
  const text = truncated ? cleaned.slice(0, INGEST_LIMITS.maxChars) : cleaned;
  return { kind, title: title.slice(0, 200), text, charCount: text.length, truncated, meta };
}

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}
