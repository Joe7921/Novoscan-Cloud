// 时间预算:跟踪总耗时与剩余时间,供各层/各 step 分配超时。

export class TimeBudget {
  private readonly startAt: number;

  constructor(
    private readonly totalMs: number,
    now: number = Date.now(),
  ) {
    this.startAt = now;
  }

  elapsed(): number {
    return Date.now() - this.startAt;
  }

  remaining(): number {
    return Math.max(0, this.totalMs - this.elapsed());
  }
}
