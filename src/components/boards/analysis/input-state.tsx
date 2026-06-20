"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  buildCombinedQuery,
  hasSubmittableContent,
  ingestFile,
  ingestUrl,
  pendingFileAttachment,
  pendingUrlAttachment,
  type Attachment,
} from "@/lib/analyze/attachments";
import { INGEST_LIMITS, type IngestKind } from "@/core/ingest/types";

const ACCEPT = ".pdf,.docx,image/png,image/jpeg,image/webp,image/gif";

// 输入态:粘贴创意/长文 + 可附 PDF/Word/图片/网页链接 → 开始分析。
export function InputState({ onSubmit }: { onSubmit: (query: string) => void }) {
  const { t, locale } = useTranslation();
  const ta = t.board.analysis.attach;
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parsing = attachments.some((a) => a.status === "parsing");
  const canSubmit = hasSubmittableContent(input, attachments) && !parsing;
  const atLimit = attachments.length >= INGEST_LIMITS.maxAttachments;

  // 更新指定附件(异步解析完成后回填)。
  const patch = (id: string, next: Partial<Attachment>) =>
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...next } : a)));

  const processFile = async (file: File) => {
    const att = pendingFileAttachment(file);
    setAttachments((prev) => [...prev, att]);
    try {
      const r = await ingestFile(file);
      patch(att.id, {
        status: "ready",
        kind: r.kind,
        title: r.title,
        text: r.text,
        charCount: r.charCount,
        truncated: r.truncated,
      });
    } catch (e) {
      patch(att.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = INGEST_LIMITS.maxAttachments - attachments.length;
    Array.from(files)
      .slice(0, Math.max(0, room))
      .forEach((f) => void processFile(f));
    if (fileRef.current) fileRef.current.value = ""; // 允许重复选同一文件
  };

  const onAddLink = async () => {
    const url = linkValue.trim();
    if (!url || atLimit) return;
    const att = pendingUrlAttachment(url);
    setAttachments((prev) => [...prev, att]);
    setLinkValue("");
    setShowLink(false);
    try {
      const r = await ingestUrl(url);
      patch(att.id, {
        status: "ready",
        kind: r.kind,
        title: r.title,
        text: r.text,
        charCount: r.charCount,
        truncated: r.truncated,
      });
    } catch (e) {
      patch(att.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const remove = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(buildCombinedQuery(input, attachments));
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.board.analysis.title}</h1>
        <p className="text-sm text-muted-foreground">{t.board.analysis.subtitle}</p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.board.analysis.inputPlaceholder}
          rows={10}
          className="w-full resize-none rounded-xl border border-input bg-card p-4 text-sm leading-relaxed shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />

        {/* 附件 chip 列表 */}
        {attachments.length > 0 && (
          <ul className="flex flex-col gap-2">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                att={a}
                locale={locale}
                labels={ta}
                onRemove={() => remove(a.id)}
              />
            ))}
          </ul>
        )}

        {/* 贴链接的内联输入 */}
        {showLink && (
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={linkValue}
              autoFocus
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onAddLink();
                if (e.key === "Escape") setShowLink(false);
              }}
              placeholder={ta.linkPlaceholder}
              className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
            <Button size="sm" variant="secondary" onClick={() => void onAddLink()} disabled={!linkValue.trim()}>
              {ta.linkConfirm}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLink(false)}>
              {ta.linkCancel}
            </Button>
          </div>
        )}

        {/* 工具条:附件入口 + 提交 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={atLimit}
            >
              <Paperclip className="h-4 w-4" />
              {ta.upload}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowLink((v) => !v)}
              disabled={atLimit}
            >
              <Link2 className="h-4 w-4" />
              {ta.link}
            </Button>
            <span className="text-xs text-muted-foreground">{atLimit ? ta.limitReached : ta.hint}</span>
          </div>

          <Button disabled={!canSubmit} onClick={submit}>
            {t.board.analysis.analyze}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
        {parsing && <p className="text-right text-xs text-muted-foreground">{ta.parsingHint}</p>}
      </div>
    </div>
  );
}

const KIND_ICON: Record<IngestKind, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  image: ImageIcon,
  web: Globe,
};

function AttachmentChip({
  att,
  locale,
  labels,
  onRemove,
}: {
  att: Attachment;
  locale: string;
  labels: { parsing: string; failed: string; remove: string; charsUnit: string; truncated: string };
  onRemove: () => void;
}) {
  const Icon = KIND_ICON[att.kind];
  return (
    <li className="flex items-center gap-3 rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{att.title}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {att.status === "parsing" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {labels.parsing}
            </>
          )}
          {att.status === "ready" && (
            <>
              {fmtChars(att.charCount ?? 0, labels.charsUnit, locale)}
              {att.truncated && <span>· {labels.truncated}</span>}
            </>
          )}
          {att.status === "error" && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              {att.error || labels.failed}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={labels.remove}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

function fmtChars(n: number, unit: string, locale: string): string {
  if (locale === "zh" && n >= 10_000) return `${(n / 10_000).toFixed(1)}万${unit}`;
  return `${n.toLocaleString()}${unit}`;
}
