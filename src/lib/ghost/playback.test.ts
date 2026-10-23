import { describe, expect, it } from "vitest";
import { findFrameIndexAt, sampleGhostAction } from "./playback";
import { makeAction, makeFrame, makeLandmarks } from "./testFixtures";

function shiftShoulder(x: number) {
  const landmarks = makeLandmarks();
  landmarks[11] = { ...landmarks[11], x };
  return landmarks;
}

describe("playback sampling", () => {
  it("finds the last frame at or before a time", () => {
    const action = makeAction();
    expect(findFrameIndexAt(action.frames, 0)).toBe(0);
    expect(findFrameIndexAt(action.frames, 99)).toBe(0);
    expect(findFrameIndexAt(action.frames, 100)).toBe(1);
    expect(findFrameIndexAt(action.frames, 9999)).toBe(2);
  });

  it("interpolates between close valid frames using timestamps", () => {
    const action = makeAction({
      frames: [
        makeFrame(0, shiftShoulder(0.4)),
        makeFrame(100, shiftShoulder(0.6)),
      ],
    });
    const sample = sampleGhostAction(action, 50);
    expect(sample.status).toBe("interpolated");
    expect(sample.landmarks?.[11].x).toBeCloseTo(0.5, 6);
  });

  it("does not interpolate across a long gap", () => {
    const action = makeAction({
      frames: [
        makeFrame(0, shiftShoulder(0.4)),
        makeFrame(1000, shiftShoulder(0.6)),
      ],
    });
    const sample = sampleGhostAction(action, 500);
    expect(sample.status).toBe("gap");
    expect(sample.landmarks).toBeNull();
  });

  it("holds a valid frame briefly when the next pose is missing", () => {
    const action = makeAction({
      frames: [
        makeFrame(0, shiftShoulder(0.4)),
        makeFrame(100, null),
        makeFrame(200, shiftShoulder(0.6)),
      ],
    });
    const sample = sampleGhostAction(action, 80);
    expect(sample.status).toBe("held");
    expect(sample.landmarks).not.toBeNull();
    expect(sample.landmarks?.[11].x).toBeCloseTo(0.4, 6);
  });

  it("clamps the start and end of the timeline", () => {
    const action = makeAction();
    expect(sampleGhostAction(action, -500).status).toBe("first");
    expect(sampleGhostAction(action, 5000).status).toBe("last");
  });

  it("does not crash on an empty frame list", () => {
    const action = makeAction({ frames: [] });
    const sample = sampleGhostAction(action, 100);
    expect(sample.status).toBe("empty");
    expect(sample.landmarks).toBeNull();
  });
});
