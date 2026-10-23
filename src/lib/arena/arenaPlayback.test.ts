import { describe, expect, it } from "vitest";
import { alignDtw } from "./dtw";
import { prepareArenaPair } from "./normalize";
import { createComparisonSampler } from "./arenaPlayback";
import { makeAction } from "../ghost/testFixtures";

function makePair(durA = 3000, durB = 3000, nA = 10, nB = 10) {
  const actionA = makeAction({
    mode: "full-body",
    frames: Array.from({ length: nA }, (_, i) => ({
      timestampMs: Math.round((i / (nA - 1)) * durA),
      landmarks: makeAction().frames[0].landmarks,
      quality: { valid: true, hasPose: true, visibleKeyJoints: 8, readinessGroups: 5, totalGroups: 5, missingGroups: [] },
    })),
  });
  const actionB = makeAction({
    mode: "full-body",
    frames: Array.from({ length: nB }, (_, i) => ({
      timestampMs: Math.round((i / (nB - 1)) * durB),
      landmarks: makeAction().frames[0].landmarks,
      quality: { valid: true, hasPose: true, visibleKeyJoints: 8, readinessGroups: 5, totalGroups: 5, missingGroups: [] },
    })),
  });
  const pair = prepareArenaPair(actionA, actionB, alignDtw);
  return { actionA, actionB, pair: pair! };
}

describe("arenaPlayback", () => {
  it("creates sampler for original-time mode", () => {
    const { actionA, actionB, pair } = makePair();
    const sampler = createComparisonSampler(actionA, actionB, "original", pair.refFrames, pair.imitFrames, pair.alignment);
    const f0 = sampler(0);
    expect(f0.refLandmarks).not.toBeNull();
    expect(f0.imitLandmarks).not.toBeNull();
  });

  it("creates sampler for DTW-aligned mode", () => {
    const { actionA, actionB, pair } = makePair();
    const sampler = createComparisonSampler(actionA, actionB, "dtw", pair.refFrames, pair.imitFrames, pair.alignment);
    const f0 = sampler(0);
    expect(f0.refNorm).not.toBeNull();
    expect(f0.imitNorm).not.toBeNull();
  });

  it("progress 0 returns first frame, progress 1 returns last", () => {
    const { actionA, actionB, pair } = makePair(5000, 5000, 30, 30);
    const sampler = createComparisonSampler(actionA, actionB, "original", pair.refFrames, pair.imitFrames, pair.alignment);
    const f0 = sampler(0);
    const f1 = sampler(1);
    expect(f0.progress).toBe(0);
    expect(f1.progress).toBe(1);
    expect(f0.refTimeMs).toBeLessThanOrEqual(f1.refTimeMs);
  });

  it("handles different duration actions in original mode", () => {
    const { actionA, actionB, pair } = makePair(3000, 8000, 10, 24);
    const sampler = createComparisonSampler(actionA, actionB, "original", pair.refFrames, pair.imitFrames, pair.alignment);
    const f = sampler(0.5);
    expect(f.refLandmarks).not.toBeNull();
    expect(f.imitLandmarks).not.toBeNull();
  });

  it("handles invalid frames gracefully in original mode", () => {
    // Even with some invalid frames, the sampler should not crash
    const { actionA, actionB } = makePair(3000, 3000, 10, 10);
    // Inject a null frame in action A
    const actionWithGap = {
      ...actionA,
      frames: actionA.frames.map((f, i) => i === 3 ? { ...f, landmarks: null, quality: { ...f.quality, valid: false, hasPose: false } } : f),
    };
    const pair2 = prepareArenaPair(actionWithGap, actionB, alignDtw);
    expect(pair2).not.toBeNull();
    const sampler = createComparisonSampler(actionWithGap, actionB, "original", pair2!.refFrames, pair2!.imitFrames, pair2!.alignment);
    // Sampling at a non-gap time should work fine
    const f = sampler(0);
    expect(f.imitLandmarks).not.toBeNull();
  });

  it("DTW mode path length matches frame count in range", () => {
    const { actionA, actionB, pair } = makePair(5000, 5000, 20, 20);
    const sampler = createComparisonSampler(actionA, actionB, "dtw", pair.refFrames, pair.imitFrames, pair.alignment);
    expect(pair.alignment.path.length).toBeGreaterThan(0);
    const mid = sampler(0.5);
    expect(mid.refNorm).not.toBeNull();
  });

  it("seek to arbitrary progress", () => {
    const { actionA, actionB, pair } = makePair(5000, 5000, 30, 30);
    const sampler = createComparisonSampler(actionA, actionB, "original", pair.refFrames, pair.imitFrames, pair.alignment);
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const f = sampler(p);
      expect(Math.abs(f.progress - p)).toBeLessThanOrEqual(0.01);
    }
  });

  it("durationMs is reported correctly", () => {
    const { actionA, actionB, pair } = makePair(4000, 6000, 20, 30);
    const sampler = createComparisonSampler(actionA, actionB, "original", pair.refFrames, pair.imitFrames, pair.alignment);
    expect(sampler.durationMs).toBe(6000);
  });
});