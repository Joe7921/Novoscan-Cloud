// 阶段 8 地基验证:确认 Claude(中转站 Vectrust)能接收并理解图片输入。
// 程序生成一张「左半红 / 右半绿」的 PNG → callVision → 检查模型是否同时认出两种颜色
//(同时认出且左右不颠倒,才证明传输+空间感知都通,而非蒙对)。
// 用法(须清除 shell 预置的 ANTHROPIC_*,让 .env.local 中转站生效):
//   env -u ANTHROPIC_BASE_URL -u ANTHROPIC_MODEL -u ANTHROPIC_API_KEY npx tsx scripts/smoke-vision.ts

import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(): void {
  let text = "";
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

// ---- 纯 Node 生成 PNG(无第三方依赖)----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}
// 生成左半红、右半绿的 RGB PNG。
function makeHalfRedGreenPNG(size = 48): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  // 10/11/12 = compression/filter/interlace = 0
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      if (x < size / 2) {
        raw[p++] = 220; raw[p++] = 20; raw[p++] = 20; // 红
      } else {
        raw[p++] = 20; raw[p++] = 200; raw[p++] = 20; // 绿
      }
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main(): Promise<void> {
  const { callVision, resolveModelName } = await import("@/core/ai-client");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ 未配置 ANTHROPIC_API_KEY,无法测试 vision");
    process.exit(1);
  }
  console.log(`[smoke-vision] provider=anthropic model=${resolveModelName("anthropic")}`);
  console.log(`[smoke-vision] baseURL=${process.env.ANTHROPIC_BASE_URL ?? "(官方默认)"}`);

  const png = makeHalfRedGreenPNG();
  console.log(`[smoke-vision] 生成测试图 ${png.length} 字节(左半红/右半绿)`);

  const t0 = Date.now();
  const res = await callVision({
    prompt:
      "仔细看这张图。它被竖直分成左右两半,每半是一种纯色。请只回答:左半是什么颜色,右半是什么颜色?格式:左=X 右=Y。",
    images: [{ data: png, mediaType: "image/png" }],
    maxOutputTokens: 2_000,
    timeoutMs: 120_000,
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const answer = res.text.trim();
  console.log(`\n[smoke-vision] 模型(${res.usedModel})${dt}s 回答:\n${answer}\n`);

  const lower = answer.toLowerCase();
  const sawRed = /红|red/.test(lower);
  const sawGreen = /绿|green/.test(lower);
  // 校验左右不颠倒:红出现在绿之前。
  const redIdx = lower.search(/红|red/);
  const greenIdx = lower.search(/绿|green/);
  const orderOk = redIdx >= 0 && greenIdx >= 0 && redIdx < greenIdx;

  if (sawRed && sawGreen && orderOk) {
    console.log("✓ 通过:中转站成功传图,模型正确认出左红右绿。理解桥地基可用。");
    process.exit(0);
  }
  console.error(
    `✗ 未通过:sawRed=${sawRed} sawGreen=${sawGreen} 顺序正确=${orderOk}。` +
      "若两色都没认出→中转站可能不透传图片;若认出但顺序乱→感知弱,需换模型。",
  );
  process.exit(2);
}

main().catch((err) => {
  console.error("✗ vision 调用抛错:", err instanceof Error ? err.message : err);
  process.exit(1);
});
