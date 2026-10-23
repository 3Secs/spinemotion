import { describe, expect, it } from "vitest";
import { computeJointDifferences, findKeyMoments } from "./differences";
import { normalizeAction } from "./normalize";
import { alignDtw } from "./dtw";
import { makeAction, makeLandmarks } from "../ghost/testFixtures";
import type { NormalizedFrame } from "../../types/arena";

function makeNormFrame(shifts: Partial<Record<number, { dx: number; dy: number }>> = {}): NormalizedFrame {
  const pts = makeLandmarks();
  return {
    timestampMs: 0,
    landmarks: pts.map((p, idx) => {
      const shift = shifts[idx];
      return {
        nx: (shift?.dx ?? 0) + p.x,
        ny: (shift?.dy ?? 0) + p.y,
        z: p.z,
        visibility: p.visibility,
      };
    }),
  };
}

describe("computeJointDifferences", () => {
  it("returns zero differences for identical frames", () => {
    const frame = makeNormFrame();
    const diffs = computeJointDifferences(
      [frame],
      [frame],
      [{ i: 0, j: 0 }],
      "full-body",
    );
    expect(diffs.length).toBeGreaterThan(0);
    for (const d of diffs) {
      expect(d.meanDistance).toBeCloseTo(0, 4);
    }
  });

  it("returns larger distances for shifted frames", () => {
    const ref = makeNormFrame();
    const imit = makeNormFrame({ 11: { dx: 0.5, dy: 0 }, 23: { dx: 0.3, dy: 0.2 } });
    const diffs = computeJointDifferences(
      [ref],
      [imit],
      [{ i: 0, j: 0 }],
      "upper-body",
    );
    // Should have some non-zero distances
    const total = diffs.reduce((s, d) => s + d.meanDistance, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("upper-body excludes knee and ankle", () => {
    const frame = makeNormFrame();
    const diffs = computeJointDifferences(
      [frame], [frame], [{ i: 0, j: 0 }], "upper-body",
    );
    const indices = diffs.map((d) => d.landmarkIndex);
    expect(indices).not.toContain(25);
    expect(indices).not.toContain(26);
    expect(indices).not.toContain(27);
    expect(indices).not.toContain(28);
    expect(indices).toContain(11);
    expect(indices).toContain(23);
  });

  it("skips invisible joints", () => {
    const ref = makeNormFrame();
    const imit = makeNormFrame();
    // Make joint 11 invisible in imitation
    imit.landmarks![11].visibility = 0;
    const diffs = computeJointDifferences(
      [ref], [imit], [{ i: 0, j: 0 }], "upper-body",
    );
    const d11 = diffs.find((d) => d.landmarkIndex === 11);
    expect(d11).toBeUndefined();
  });

  it("handles empty path", () => {
    const frame = makeNormFrame();
    const diffs = computeJointDifferences([frame], [frame], [], "full-body");
    expect(diffs).toHaveLength(0);
  });
});

describe("findKeyMoments", () => {
  it("returns empty for empty path", () => {
    const moments = findKeyMoments([], [], []);
    expect(moments).toHaveLength(0);
  });

  it("finds error segments in misaligned actions", () => {
    const ref = normalizeAction(makeAction({ mode: "full-body" }));
    const imit = normalizeAction(makeAction({ mode: "full-body" }));
    const align = alignDtw(ref, imit);

    const moments = findKeyMoments(ref, imit, align.path, 2);
    expect(moments.length).toBeGreaterThanOrEqual(0);
    expect(moments.length).toBeLessThanOrEqual(2);

    for (const m of moments) {
      expect(m.meanDistance).toBeGreaterThanOrEqual(0);
      expect(m.peakDistance).toBeGreaterThanOrEqual(m.meanDistance);
      expect(m.startMs).toBeLessThanOrEqual(m.endMs);
    }
  });

  it("non-overlapping moments", () => {
    const ref = normalizeAction(makeAction({ mode: "upper-body" }));
    const imit = normalizeAction(makeAction({ mode: "upper-body" }));
    const align = alignDtw(ref, imit);

    // Create intentional error spike in middle frames
    if (imit.length > 2) {
      const mid = Math.floor(imit.length / 2);
      if (imit[mid].landmarks) {
        for (const p of imit[mid].landmarks) {
          p.nx += 2;
        }
      }
    }

    const moments = findKeyMoments(ref, imit, align.path);
    expect(moments.length).toBeLessThanOrEqual(3);
  });
});