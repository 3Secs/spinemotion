import { describe, expect, it } from "vitest";
import { alignDtw, frameDistance, runDtw } from "./dtw";
import { normalizeAction } from "./normalize";
import { makeAction, makeLandmarks } from "../ghost/testFixtures";
import type { NormalizedFrame } from "../../types/arena";

function makeNormFrame(shift: number = 0): NormalizedFrame {
  const landmarks = makeLandmarks();
  return {
    timestampMs: 0,
    landmarks: landmarks.map((p) => ({
      nx: p.x + shift,
      ny: p.y + shift,
      z: p.z,
      visibility: p.visibility,
    })),
  };
}

describe("frameDistance", () => {
  it("returns 0 for identical frames", () => {
    const a = makeNormFrame();
    const b = makeNormFrame();
    expect(frameDistance(a, b)).toBeCloseTo(0, 5);
  });

  it("returns 1 when either frame has null landmarks", () => {
    const a = makeNormFrame();
    const b: NormalizedFrame = { timestampMs: 0, landmarks: null };
    expect(frameDistance(a, b)).toBe(1);
    expect(frameDistance(b, a)).toBe(1);
  });

  it("increases with spatial distance", () => {
    const a = makeNormFrame(0);
    const b = makeNormFrame(1);
    expect(frameDistance(a, b)).toBeGreaterThan(frameDistance(a, a));
  });

  it("is symmetric", () => {
    const a = makeNormFrame(0);
    const b = makeNormFrame(0.5);
    expect(frameDistance(a, b)).toBeCloseTo(frameDistance(b, a), 5);
  });
});

describe("alignDtw", () => {
  it("returns empty result for empty sequences", () => {
    const result = alignDtw([], []);
    expect(result.path).toHaveLength(0);
    expect(result.normalizedCost).toBe(0);
  });

  it("aligns identical sequences trivially", () => {
    const frames = [makeNormFrame(), makeNormFrame(), makeNormFrame()];
    const result = alignDtw(frames, frames);
    expect(result.normalizedCost).toBeCloseTo(0, 3);
    // Path should be a clean diagonal
    for (const step of result.path) {
      expect(step.i).toBe(step.j);
    }
  });

  it("aligns sequences of different lengths", () => {
    const a = [makeNormFrame(), makeNormFrame(), makeNormFrame()];
    const b = [makeNormFrame(), makeNormFrame()];
    const result = alignDtw(a, b);
    expect(result.path.length).toBeGreaterThan(0);
    // First step should map (0,0), last should map (2,1)
    expect(result.path[0]).toEqual({ i: 0, j: 0 });
    const last = result.path[result.path.length - 1];
    expect(last.i).toBe(2);
    expect(last.j).toBe(1);
  });

  it("normalized cost is non-negative", () => {
    const ref = makeAction({ mode: "full-body" });
    const imit = makeAction({ mode: "full-body" });
    const r = normalizeAction(ref);
    const m = normalizeAction(imit);
    const result = alignDtw(r, m);
    expect(result.normalizedCost).toBeGreaterThanOrEqual(0);
  });

  it("runDtw is the same as alignDtw", () => {
    const a = [makeNormFrame(), makeNormFrame()];
    const b = [makeNormFrame(), makeNormFrame()];
    expect(runDtw(a, b)).toEqual(alignDtw(a, b));
  });

  it("path preserves monotonicity", () => {
    const a = [makeNormFrame(), makeNormFrame(), makeNormFrame(), makeNormFrame()];
    const b = [makeNormFrame(), makeNormFrame()];
    const result = alignDtw(a, b);
    for (let k = 1; k < result.path.length; k += 1) {
      const prev = result.path[k - 1];
      const cur = result.path[k];
      expect(cur.i).toBeGreaterThanOrEqual(prev.i);
      expect(cur.j).toBeGreaterThanOrEqual(prev.j);
      // At least one index must advance
      expect(cur.i + cur.j).toBeGreaterThan(prev.i + prev.j);
    }
  });
});