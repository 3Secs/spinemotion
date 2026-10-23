import { describe, expect, it } from "vitest";
import {
  elapsedSeconds,
  formatClock,
  formatSeconds,
  nextMonotonicTimestamp,
  toSessionTimestamp,
} from "./time";

describe("nextMonotonicTimestamp", () => {
  it("accepts the first candidate", () => {
    expect(nextMonotonicTimestamp(null, 1234.5)).toBe(1234.5);
  });

  it("forces strictly increasing timestamps", () => {
    expect(nextMonotonicTimestamp(1000, 1000)).toBe(1001);
    expect(nextMonotonicTimestamp(1000, 900)).toBe(1001);
    expect(nextMonotonicTimestamp(1000, 1020)).toBe(1020);
  });

  it("supports a custom minimum step", () => {
    expect(nextMonotonicTimestamp(1000, 1000, 5)).toBe(1005);
  });

  it("rejects non-finite timestamps", () => {
    expect(() => nextMonotonicTimestamp(null, Number.NaN)).toThrow();
    expect(() => nextMonotonicTimestamp(null, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("media timestamp mapping", () => {
  it("maps source seconds to a session timeline", () => {
    expect(toSessionTimestamp(10_000, 1.25)).toBe(11_250);
  });

  it("clamps negative source time to zero", () => {
    expect(toSessionTimestamp(10_000, -2)).toBe(10_000);
  });

  it("rejects invalid input", () => {
    expect(() => toSessionTimestamp(Number.NaN, 1)).toThrow();
  });
});

describe("time formatting", () => {
  it("clamps elapsed time at zero", () => {
    expect(elapsedSeconds(2000, 1500)).toBe(0);
    expect(elapsedSeconds(2000, 3500)).toBe(1.5);
  });

  it("formats seconds and clock values", () => {
    expect(formatSeconds(1.234, 2)).toBe("1.23s");
    expect(formatSeconds(-1)).toBe("—");
    expect(formatClock(65.4)).toBe("01:05.4");
  });
});
