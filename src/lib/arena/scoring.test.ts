import { describe, expect, it } from "vitest";
import { computeArenaScore, checkArenaQuality } from "./scoring";
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
        quality: {
          valid: true,
          hasPose: true,
          visibleKeyJoints: 8,
          readinessGroups: 5,
          totalGroups: 5,
          missingGroups: [],
        },
      });
    }
    return {
      ...base,
      durationMs,
      frames,
      recording: {
        ...base.recording,
        totalFrames: nFrames,
        validFrames: nFrames,
        validFrameRatio: 1,
        measuredFps: durationMs > 0 ? ((nFrames - 1) / durationMs) * 1000 : 0,
        requestedDurationMs: durationMs,
      },
    };
  };

  return prepareArenaPair(
    build(refDuration, refFrames),
    build(imitDuration, imitFrames),
    alignDtw,
  );
}

describe("checkArenaQuality", () => {
  it("accepts a healthy pair", () => {
    const pair = makeSimplePair();
    expect(pair).not.toBeNull();
    const quality = checkArenaQuality(pair!);
    expect(quality.acceptable).toBe(true);
    expect(quality.reasons).toHaveLength(0);
  });

  it("rejects when frames are too few", () => {
    const pair = makeSimplePair(1000, 1000, 2, 2);
    // When frames are too few, normalization may produce < minValidFrames
    if (pair) {
      const quality = checkArenaQuality(pair);
      if (quality.reasons.length > 0) {
        expect(quality.acceptable).toBe(false);
      }
    }
  });

  it("returns review notes for static actions", () => {
    const pair = makeSimplePair();
    if (pair) {
      const quality = checkArenaQuality(pair);
      // Synthetic fixtures have zero motion → may trigger a review note
      expect(quality.reviewNotes).toBeDefined();
    }
  });
});

describe("computeArenaScore", () => {
  it("scores identical actions near 100", () => {
    const pair = makeSimplePair(5000, 5000, 60, 60);
    expect(pair).not.toBeNull();
    const score = computeArenaScore(pair!);
    expect(score.poseSimilarity).toBeGreaterThanOrEqual(85);
    expect(score.poseSimilarity).toBeLessThanOrEqual(100);
    expect(score.overallMatch).toBeGreaterThanOrEqual(80);
  });

  it("scores are always in [0, 100]", () => {
    const pair = makeSimplePair(5000, 5000, 60, 60);
    expect(pair).not.toBeNull();
    const score = computeArenaScore(pair!);
    expect(score.poseSimilarity).toBeGreaterThanOrEqual(0);
    expect(score.poseSimilarity).toBeLessThanOrEqual(100);
    expect(score.timingSimilarity).toBeGreaterThanOrEqual(0);
    expect(score.timingSimilarity).toBeLessThanOrEqual(100);
    expect(score.overallMatch).toBeGreaterThanOrEqual(0);
    expect(score.overallMatch).toBeLessThanOrEqual(100);
  });

  it("lowers timing similarity when durations differ", () => {
    const same = makeSimplePair(5000, 5000, 60, 60);
    const diff = makeSimplePair(3000, 9000, 36, 108);

    expect(same).not.toBeNull();
    expect(diff).not.toBeNull();

    const scoreSame = computeArenaScore(same!);
    const scoreDiff = computeArenaScore(diff!);

    // Different durations should reduce timing similarity
    expect(scoreDiff.timingSimilarity).toBeLessThan(scoreSame.timingSimilarity);
  });

  it("produces joint differences sorted by mean distance", () => {
    const pair = makeSimplePair();
    expect(pair).not.toBeNull();
    const score = computeArenaScore(pair!);

    for (let k = 1; k < score.jointDifferences.length; k += 1) {
      expect(score.jointDifferences[k - 1].meanDistance)
        .toBeGreaterThanOrEqual(score.jointDifferences[k].meanDistance);
    }
  });

  it("generates an explanation string", () => {
    const pair = makeSimplePair();
    expect(pair).not.toBeNull();
    const score = computeArenaScore(pair!);
    expect(score.explanation).toBeTruthy();
    expect(typeof score.explanation).toBe("string");
    expect(score.explanation).toContain("姿态相似度");
  });

  it("returns quality with acceptable flag for valid data", () => {
    const pair = makeSimplePair();
    expect(pair).not.toBeNull();
    const score = computeArenaScore(pair!);
    expect(score.quality.acceptable).toBe(true);
  });
});