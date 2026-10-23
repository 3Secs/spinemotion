import { describe, expect, it } from "vitest";
import { Ema, FpsMeter } from "./metrics";

describe("FpsMeter", () => {
  it("returns zero during the warmup period", () => {
    const meter = new FpsMeter(1500, 500);
    meter.record(0);
    meter.record(100);
    meter.record(200);
    expect(meter.value()).toBe(0);
  });

  it("computes a rolling actual inference rate", () => {
    const meter = new FpsMeter(2000, 500);
    for (let time = 0; time <= 1000; time += 100) {
      meter.record(time);
    }
    expect(meter.value()).toBeCloseTo(10, 5);
  });

  it("drops stale samples outside the rolling window", () => {
    const meter = new FpsMeter(500, 100);
    meter.record(0);
    meter.record(100);
    meter.record(200);
    meter.record(300);
    meter.record(1900);
    meter.record(2000);
    // Only 1900 and 2000 remain in the 500 ms window → one interval / 100 ms.
    expect(meter.value()).toBeCloseTo(10, 5);
  });
});

describe("Ema", () => {
  it("seeds with the first sample and smooths thereafter", () => {
    const ema = new Ema(0.2);
    expect(ema.push(100)).toBe(100);
    expect(ema.get()).toBe(100);
    expect(ema.push(150)).toBeCloseTo(110, 5);
    expect(ema.get()).toBeCloseTo(110, 5);
  });

  it("resets cleanly", () => {
    const ema = new Ema(0.5);
    ema.push(10);
    ema.reset();
    expect(ema.get()).toBeNull();
  });
});
