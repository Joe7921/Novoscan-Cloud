// PDF 解析:unpdf 本地抽文字(省钱;扫描件无文字层时返回空,后期可接 OCR/vision 兜底)。

import { extractText, getDocumentProxy } from "unpdf";
import { IngestError } from "./types";

/** 从 PDF 字节抽取纯文字(合并所有页)。 */
export async function parsePdf(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    // mergePages: true → text 为合并后的单个字符串。
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    throw new IngestError(
      `PDF 解析失败:${err instanceof Error ? err.message : String(err)}(可能是加密或损坏的文件)`,
      "bad_input",
    );
  }
}
