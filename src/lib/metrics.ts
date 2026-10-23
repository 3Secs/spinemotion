/**
 * Small, dependency-free rolling metrics used by the capture pipeline.
 * They intentionally update outside React; the UI samples them at ~4 Hz.
 */

export class FpsMeter {
  private samples: number[] = [];
  private readonly windowMs: number;
  private readonly warmupMs: number;

  constructor(windowMs = 1500, warmupMs = 500) {
    this.windowMs = windowMs;
    this.warmupMs = warmupMs;
  }

  record(nowMs: number): void {
    this.samples.push(nowMs);
    const cutoff = nowMs - this.windowMs;
    while (this.samples.length > 0 && this.samples[0] < cutoff) {
      this.samples.shift();
    }
  }

  value(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const span = last - first;
    if (span < this.warmupMs) return 0;
    return ((this.samples.length - 1) / span) * 1000;
  }

  reset(): void {
    this.samples = [];
  }
}

/** Exponential moving average for inference latency. */
export class Ema {
  private value: number | null = null;

  constructor(private readonly alpha = 0.2) {}

  push(sample: number): number {
    if (this.value === null) {
      this.value = sample;
    } else {
      this.value = this.alpha * sample + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  get(): number | null {
    return this.value;
  }

  reset(): void {
    this.value = null;
  }
}
