import { createHash } from "node:crypto";

// 查询归一化 + 哈希。
// query_hash 同时是 search_history 的缓存命中键、agent_memory 的去重键,
// 归一化规则直接影响缓存命中率与记忆去重质量,故集中在此一处定义。
// 仅服务端使用(node:crypto)。如将来需在 Edge/浏览器算哈希,改用 Web Crypto 异步版。

/**
 * 归一化用户查询。规则保持「温和」——只消除无意义差异,不抹掉语义:
 *  1. Unicode NFKC 规范化(全角→半角、兼容字符统一);
 *  2. 连续空白(含换行/制表)压成单个空格,并去首尾空白;
 *  3. 英文字母转小写(中文无大小写,不受影响)。
 * 刻意不去标点、不去停用词:它们可能携带语义,过度归一化会让不同创意误撞同一哈希。
 */
export function normalizeQuery(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 对归一化后的查询算 SHA-256(hex)。
 * 不掺入 language/mode:search_history 用 (query_hash, language, mode) 复合键区分,
 * agent_memory 按 query_hash 去重(记忆与语言无关)。
 */
export function queryHash(input: string): string {
  return createHash("sha256").update(normalizeQuery(input)).digest("hex");
}
