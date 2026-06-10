// 关键词提取 + 中英双语变体。AI(国产模型)优先,无 key 降级本地分词。
// 参考旧库 query-keyword-extractor / dual-track-utils 重写。

import { callByTier, isProviderAvailable, parseAgentJSON } from "@/core/ai-client";

const STOPWORDS = new Set([
  // 中文虚词
  "的", "了", "在", "是", "我", "想", "做", "有", "个", "一", "能", "可以", "要", "和", "与",
  "及", "或", "用", "把", "让", "被", "给", "去", "来", "上", "下", "很", "也", "都", "就",
  "不", "没", "会", "将", "对", "但", "而", "如果", "通过", "进行", "使用", "利用", "基于",
  "实现", "提供", "帮助", "解决", "方面", "方式", "针对", "面向", "关于", "包括",
  // 英文停用词
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "with", "by", "is", "are",
  "this", "that", "it", "as", "at", "be", "can", "will", "we", "i", "you", "how", "what",
]);

export function containsChinese(text: string): boolean {
  return /[一-龥]/.test(text);
}

function hasAIKey(): boolean {
  return (
    isProviderAvailable("deepseek") ||
    isProviderAvailable("minimax") ||
    isProviderAvailable("moonshot")
  );
}

// 本地分词降级:抽中文词组 + 英文词,去停用词,按长度取前 8。
function localExtract(query: string): string[] {
  const zh = [...query.matchAll(/[一-龥]{2,8}/g)]
    .map((m) => m[0])
    .filter((t) => !STOPWORDS.has(t));
  const en = [...query.matchAll(/[a-zA-Z][a-zA-Z0-9.+-]{1,}/g)]
    .map((m) => m[0])
    .filter((t) => !STOPWORDS.has(t.toLowerCase()));
  return [...new Set([...zh, ...en])].sort((a, b) => b.length - a.length).slice(0, 8);
}

async function aiExtract(query: string): Promise<string[]> {
  const r = await callByTier("fast", {
    prompt: `从下面的创意中提取 5-8 个最适合学术/产业检索的核心关键词。只输出 JSON 字符串数组,如 ["关键词1","关键词2"],不要任何解释:\n\n${query}`,
    maxOutputTokens: 200,
    temperature: 0,
    timeoutMs: 15_000,
  });
  const arr = parseAgentJSON<unknown>(r.text);
  if (!Array.isArray(arr)) return [];
  return arr.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 8);
}

/** 提取检索关键词。精准短词直通;否则 AI 提取,失败本地降级。 */
export async function extractKeywords(query: string): Promise<string[]> {
  const q = query.trim();
  if (q.length <= 12 && !/[,，。;；\s]/.test(q)) return [q]; // 精准术语直通
  if (hasAIKey()) {
    try {
      const k = await aiExtract(q);
      if (k.length > 0) return k;
    } catch {
      /* 降级 */
    }
  }
  const local = localExtract(q);
  return local.length > 0 ? local : [q];
}

/** 构造检索变体:基础关键词组 + (中文创意时)英文关键词组,提高召回。 */
export async function buildQueryVariants(query: string): Promise<string[]> {
  const base = await extractKeywords(query);
  const variants = [base.join(" ")];
  if (containsChinese(query) && hasAIKey()) {
    try {
      const r = await callByTier("fast", {
        prompt: `把下面的创意翻译并提炼成 5-8 个英文学术检索关键词,只输出空格分隔的英文词,不要解释:\n\n${query}`,
        maxOutputTokens: 100,
        temperature: 0,
        timeoutMs: 15_000,
      });
      const en = r.text.replace(/[\n"]/g, " ").replace(/\s+/g, " ").trim();
      if (en) variants.push(en);
    } catch {
      /* 仅用基础组 */
    }
  }
  return variants;
}
