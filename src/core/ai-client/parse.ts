// AI 原始文本 → JSON 的四级自愈解析(参考旧库 parseAgentJSON)。
// 模型可能把 JSON 包在 ```json 块里、或因 maxOutputTokens 截断,需逐级兜底。

/** 解析失败时抛出,携带原始文本片段便于排查。 */
export class AgentJSONParseError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
    this.name = "AgentJSONParseError";
  }
}

/** 提取最外层平衡花括号包裹的 JSON 子串(找不到返回 null)。 */
function extractBalanced(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // 未闭合(可能被截断)
}

/** 对被截断的 JSON 做补全:补足未闭合的引号/括号。 */
function repairTruncated(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let s = text.slice(start);
  // 去掉尾部不完整片段(最后一个逗号之后到结尾)。
  const lastComma = s.lastIndexOf(",");
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inStr) {
    // 字符串未闭合:回退到最后一个完整字段。
    if (lastComma > 0) s = s.slice(0, lastComma);
    else return null;
  }
  // 重新统计待闭合括号并补足。
  const open: string[] = [];
  inStr = false;
  esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") open.push(ch);
    else if (ch === "}" || ch === "]") open.pop();
  }
  let closed = s;
  for (let i = open.length - 1; i >= 0; i--) {
    closed += open[i] === "{" ? "}" : "]";
  }
  return closed;
}

/** 从 AI 原始文本中提取并解析 JSON,四级兜底。 */
export function parseAgentJSON<T = unknown>(text: string): T {
  // 1. ```json ... ``` 代码块
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      /* 继续下一级 */
    }
  }
  // 2. 直接整体解析
  try {
    return JSON.parse(text.trim()) as T;
  } catch {
    /* 继续 */
  }
  // 3. 最外层平衡花括号
  const balanced = extractBalanced(text);
  if (balanced) {
    try {
      return JSON.parse(balanced) as T;
    } catch {
      /* 继续 */
    }
  }
  // 4. 截断补全
  const repaired = repairTruncated(text);
  if (repaired) {
    try {
      return JSON.parse(repaired) as T;
    } catch {
      /* 落到抛错 */
    }
  }
  throw new AgentJSONParseError("无法从模型输出中解析出 JSON", text.slice(0, 500));
}
