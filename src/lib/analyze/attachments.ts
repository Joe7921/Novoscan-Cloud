// 附件(富输入)前端逻辑:调 /api/ingest 解析,管理附件状态,提交时把正文 + 各附件
// 拼成带来源标注的结构化输入。来源分离体现在:UI 层(独立 chip)+ 输入结构(【附件N:标题】)。

import type { IngestKind, IngestResult } from "@/core/ingest/types";

export type AttachmentStatus = "parsing" | "ready" | "error";

/** 一个附件在前端的完整状态。 */
export interface Attachment {
  /** 前端本地唯一 id(非后端) */
  id: string;
  kind: IngestKind;
  /** 文件名 / 网页标题(解析前先用占位,解析成功后用后端标题) */
  title: string;
  status: AttachmentStatus;
  /** 解析成功后的富文字 */
  text?: string;
  charCount?: number;
  truncated?: boolean;
  /** 解析失败原因 */
  error?: string;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `att_${seq}`;
}

/** 据文件名/类型猜来源种类(仅用于解析前占位显示;后端会再精判)。 */
export function guessKind(nameOrType: string): IngestKind {
  const s = nameOrType.toLowerCase();
  if (s.includes("pdf")) return "pdf";
  if (s.includes("word") || s.endsWith(".docx") || s.includes("officedocument")) return "docx";
  if (/image|\.(png|jpe?g|webp|gif)$/.test(s)) return "image";
  return "pdf";
}

/** 新建一个"解析中"的占位附件。 */
export function pendingFileAttachment(file: File): Attachment {
  return {
    id: nextId(),
    kind: guessKind(file.type || file.name),
    title: file.name,
    status: "parsing",
  };
}

export function pendingUrlAttachment(url: string): Attachment {
  return { id: nextId(), kind: "web", title: url, status: "parsing" };
}

/** 调接口解析文件;返回后端结果或抛出可读错误。 */
export async function ingestFile(file: File, signal?: AbortSignal): Promise<IngestResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/ingest", { method: "POST", body: form, signal });
  return readResult(res);
}

/** 调接口解析网页链接。 */
export async function ingestUrl(url: string, signal?: AbortSignal): Promise<IngestResult> {
  const res = await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
  return readResult(res);
}

async function readResult(res: Response): Promise<IngestResult> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`解析服务返回异常(${res.status})`);
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error;
    throw new Error(msg || `解析失败(${res.status})`);
  }
  return data as IngestResult;
}

const KIND_LABEL: Record<IngestKind, string> = {
  pdf: "PDF",
  docx: "Word",
  web: "网页",
  image: "图片",
};

/**
 * 把正文 + 已就绪附件拼成结构化输入(带来源标注)。
 * 只纳入 status==="ready" 且有文字的附件;附件按加入顺序编号。
 */
export function buildCombinedQuery(mainText: string, attachments: Attachment[]): string {
  const ready = attachments.filter((a) => a.status === "ready" && a.text?.trim());
  const parts: string[] = [];
  const main = mainText.trim();
  if (main) parts.push(main);

  ready.forEach((a, i) => {
    const trunc = a.truncated ? "(内容较长,已截取前部分)" : "";
    const head = `【附件${i + 1}·${KIND_LABEL[a.kind]}:${a.title}】${trunc}`;
    parts.push(`${head}\n${a.text!.trim()}`);
  });

  return parts.join("\n\n");
}

/** 提交前的可用性:正文非空,或至少一个就绪附件。 */
export function hasSubmittableContent(mainText: string, attachments: Attachment[]): boolean {
  if (mainText.trim().length > 0) return true;
  return attachments.some((a) => a.status === "ready" && !!a.text?.trim());
}
