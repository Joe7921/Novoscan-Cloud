// 超时辅助:给一个 Promise 加超时上限,超时则 reject(不阻断其它任务)。

export async function runWithTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时(${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 等待 promises 中任意 n 个先结算(成功或失败均计数)。用于 2/3 多数推进。 */
export function waitForN(promises: Array<Promise<unknown>>, n: number): Promise<void> {
  if (n <= 0 || promises.length === 0) return Promise.resolve();
  const need = Math.min(n, promises.length);
  return new Promise<void>((resolve) => {
    let settled = 0;
    for (const p of promises) {
      void Promise.resolve(p).finally(() => {
        settled += 1;
        if (settled >= need) resolve();
      });
    }
  });
}
