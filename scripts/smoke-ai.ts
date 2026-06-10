// 验收①:真打通模型。对每个已配置 Key 的 provider 各发一次调用,验证 ai-client 通路。
// 用法:npx tsx scripts/smoke-ai.ts  (需 .env.local 配好对应 API Key)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { callAI, isProviderAvailable, PROVIDERS, type ProviderId } from "@/core/ai-client";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 加载 .env.local 到 process.env(ai-client 在调用时惰性读取)。
function loadEnv(): void {
  let text = "";
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    console.warn("未找到 .env.local");
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

async function main(): Promise<void> {
  const providers: ProviderId[] = ["deepseek", "minimax", "moonshot", "anthropic"];
  let anySuccess = false;

  for (const provider of providers) {
    if (!isProviderAvailable(provider)) {
      console.log(`⏭️  ${provider} 未配置 Key(${PROVIDERS[provider].envApiKey}),跳过`);
      continue;
    }
    try {
      const r = await callAI({
        provider,
        prompt: "用一句话回答:请说出你是哪个模型,并确认你能正常工作。",
        maxOutputTokens: 200,
        timeoutMs: 60_000,
      });
      console.log(
        `✅ ${provider}[${r.usedKeyLabel}] (${r.usedModel}): ${r.text.replace(/\s+/g, " ").slice(0, 100)}`,
      );
      anySuccess = true;
    } catch (e) {
      console.log(`❌ ${provider} 失败: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (!anySuccess) throw new Error("没有任何 provider 调通(检查 Key 与模型名)");
  console.log("\n🎉 验收①:至少一个模型已真打通。");
}

main().catch((e) => {
  console.error("\n❌ 失败:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
