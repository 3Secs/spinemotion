import { describe, expect, it } from "vitest";
import { computeArenaScore, checkArenaQuality, type ArenaScoreMode } from "./scoring";
import { prepareArenaPair } from "./normalize";
import { alignDtw } from "./dtw";
import { makeAction, makeLandmarks } from "../ghost/testFixtures";
import type { GhostAction, GhostFrame } from "../../types/ghost";

function makeSimplePair(
  refDuration = 5000,
  imitDuration = 5000,
  refFrames = 60,
  imitFrames = 60,
): ReturnType<typeof prepareArenaPair> {
  const base = makeAction({ mode: "full-body" });

  const build = (durationMs: number, nFrames: number): GhostAction => {
    const interval = durationMs / (nFrames - 1);
    const frames: GhostFrame[] = [];
    for (let i = 0; i < nFrames; i += 1) {
      frames.push({
        timestampMs: Math.round(i * interval),
        landmarks: makeLandmarks(),
        quality: { valid: true, hasPose: true, visibleKeyJoints: 8, readinessGroups: 5, totalGroups: 5, missingGroups: [] },
      });
    }
    return {
      ...base,
      durationMs,
      frames,
      recording: { ...base.recording, totalFrames: nFrames, validFrames: nFrames, validFrameRatio: 1, measuredFps: durationMs > 0 ? ((nFrames - 1) / durationMs) * 1000 : 0, requestedDurationMs: durationMs },
    };
  };

  return prepareArenaPair(build(refDuration, refFrames), build(imitDuration, imitFrames), alignDtw);
}

function testModes(fn: (mode: ArenaScoreMode) => void) {
  for (const mode of ["casual", "research"] as ArenaScoreMode[]) fn(mode);
}

describe("checkArenaQuality", () => {
  testModes((mode) => {
    it(`[${mode}] accepts a healthy pair`, () => {
      const pair = makeSimplePair();
      expect(pair).not.toBeNull();
      const quality = checkArenaQuality(pair!, mode);
      expect(quality.acceptable).toBe(true);
    });
  });
});

describe("computeArenaScore", () => {
  testModes((mode) => {
    it(`[${mode}] scores identical actions near 100`, () => {
      const pair = makeSimplePair(5000, 5000, 60, 60);
      expect(pair).not.toBeNull();
      const score = computeArenaScore(pair!, mode);
      expect(score.poseSimilarity).toBeGreaterThanOrEqual(85);
      expect(score.overallMatch).toBeGreaterThanOrEqual(80);
    });

    it(`[${mode}] scores in [0, 100]`, () => {
      const pair = makeSimplePair();
      expect(pair).not.toBeNull();
      const score = computeArenaScore(pair!, mode);
      expect(score.poseSimilarity).toBeGreaterThanOrEqual(0);
      expect(score.poseSimilarity).toBeLessThanOrEqual(100);
      expect(score.overallMatch).toBeGreaterThanOrEqual(0);
      expect(score.overallMatch).toBeLessThanOrEqual(100);
    });

    it(`[${mode}] joint diffs sorted by mean distance`, () => {
      const pair = makeSimplePair();
      expect(pair).not.toBeNull();
      const score = computeArenaScore(pair!, mode);
      for (let k = 1; k < score.jointDifferences.length; k += 1) {
        expect(score.jointDifferences[k - 1].meanDistance).toBeGreaterThanOrEqual(score.jointDifferences[k].meanDistance);
      }
    });

    it(`[${mode}] explanation contains mode label`, () => {
      const pair = makeSimplePair();
      expect(pair).not.toBeNull();
      const score = computeArenaScore(pair!, mode);
      expect(score.explanation).toContain("评分模式");
      expect(score.explanation).toContain(mode === "casual" ? "娱乐" : "分析");
    });

    it(`[${mode}] joint labels are Chinese`, () => {
      const pair = makeSimplePair();
      expect(pair).not.toBeNull();
      const score = computeArenaScore(pair!, mode);
      for (const jd of score.jointDifferences) {
        expect(jd.labelZh).toBeTruthy();
        expect(jd.labelZh).not.toBe("");
      }
    });
  });

  it("casual mode scores higher than research on same data", () => {
    const pair = makeSimplePair(5000, 5000, 60, 60);
    expect(pair).not.toBeNull();
    const casual = computeArenaScore(pair!, "casual");
    const research = computeArenaScore(pair!, "research");
    // Casual should never be lower than research for identical synthetic data
    // (weights reduce effective distance → higher similarity)
    expect(casual.poseSimilarity).toBeGreaterThanOrEqual(research.poseSimilarity);
  });

  it("lowers timing similarity when durations differ", () => {
    const same = makeSimplePair(5000, 5000, 60, 60);
    const diff = makeSimplePair(3000, 9000, 36, 108);
    expect(same).not.toBeNull();
    expect(diff).not.toBeNull();
    expect(computeArenaScore(diff!, "casual").timingSimilarity).toBeLessThan(computeArenaScore(same!, "casual").timingSimilarity);
  });
});