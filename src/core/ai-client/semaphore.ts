// 并发信号量:限制同时进行的 AI 调用数,防止打爆模型并发额度。
// high=主信号量(Agent 调用),low=低优先级(后台任务,如跨域/记忆)。

import { SEMAPHORE } from "./config";

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    // 名额已满:排队,等待 release 转交名额。
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next(); // 名额直接转交给等待者(active 不变,无竞态)
    } else {
      this.active -= 1;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const highSemaphore = new Semaphore(SEMAPHORE.high);
const lowSemaphore = new Semaphore(SEMAPHORE.low);

export type Priority = "high" | "low";

export function withSemaphore<T>(priority: Priority, fn: () => Promise<T>): Promise<T> {
  return (priority === "high" ? highSemaphore : lowSemaphore).run(fn);
}
