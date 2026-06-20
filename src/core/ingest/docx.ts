// Word 解析:mammoth 抽 .docx 纯文字(只支持 .docx,不支持老 .doc)。

import mammoth from "mammoth";
import { IngestError } from "./types";

/** 从 .docx 字节抽取纯文字。 */
export async function parseDocx(bytes: Uint8Array): Promise<string> {
  try {
    // mammoth Node 端接收 Buffer。
    const buffer = Buffer.from(bytes);
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  } catch (err) {
    throw new IngestError(
      `Word 解析失败:${err instanceof Error ? err.message : String(err)}(仅支持 .docx,不支持老式 .doc)`,
      "bad_input",
    );
  }
}
