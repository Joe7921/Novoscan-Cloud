// 富输入解析层(ingest)的契约与限额。
// 四类来源:PDF(unpdf)/ Word(mammoth)/ 网页(Jina Reader)/ 图片(callVision 理解桥)。
// 解析结果统一为「纯富文字 + 元信息」,在所有模式/管线的上游,转好再喂引擎。

/** 来源类型。 */
export type IngestKind = "pdf" | "docx" | "web" | "image";

/** 解析结果(成功)。 */
export interface IngestResult {
  kind: IngestKind;
  /** 来源标题(文件名 / 网页标题),用于来源标注 `【附件N:标题】` */
  title: string;
  /** 抽取出的富文字(已清洗归一化、按上限封顶) */
  text: string;
  /** 最终字数(text.length) */
  charCount: number;
  /** 是否因超过字数上限被截断 */
  truncated: boolean;
  /** 来源补充(网页 URL、图片 MIME 等),便于日志/溯源 */
  meta?: Record<string, string | number>;
}

/** 限额(集中一处,避免散落硬编码;可按需调整)。 */
export const INGEST_LIMITS = {
  /** PDF / Word 单文件字节上限 = 10 MB */
  maxDocBytes: 10 * 1024 * 1024,
  /** 图片单文件字节上限 = 5 MB(贴合多模态模型单图约束) */
  maxImageBytes: 5 * 1024 * 1024,
  /** 单附件抽取字数封顶 = 5 万字(超出截断并标注) */
  maxChars: 50_000,
  /** 一次分析的附件数量上限 */
  maxAttachments: 5,
  /** 网页抓取超时 */
  webTimeoutMs: 30_000,
  /** 图片理解(vision)超时 */
  imageTimeoutMs: 120_000,
} as const;

/** 解析失败:带用户可读的中文原因(接口据此回 4xx/5xx)。 */
export class IngestError extends Error {
  constructor(
    message: string,
    /** http 状态语义:bad_input=用户侧(4xx) / upstream=外部失败(502) / internal */
    readonly category: "bad_input" | "upstream" | "internal" = "bad_input",
  ) {
    super(message);
    this.name = "IngestError";
  }
}
