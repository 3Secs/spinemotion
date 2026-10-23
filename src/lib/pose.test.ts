import { describe, expect, it } from "vitest";
import { KEY_JOINT_INDICES, QUALITY_THRESHOLDS } from "../config/constants";
import type { PosePoint } from "../types/pose";
import {
  assessFraming,
  averageVisibility,
  classifyPoseSignal,
  countVisibleKeyJoints,
  toPixelCoordinate,
  toPosePoint,
  toPosePoints,
} from "./pose";

function makeLandmarks(visibility = 0.9): PosePoint[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: index / 33,
    y: index / 66,
    z: 0,
    visibility,
  }));
}

describe("pose conversion and visibility", () => {
  it("keeps normalized coordinates and defaults missing visibility to zero", () => {
    expect(toPosePoint({ x: 0.25, y: 0.5, z: -0.1 })).toEqual({
      x: 0.25,
      y: 0.5,
      z: -0.1,
      visibility: 0,
    });
  });

  it("only accepts a complete 33-point pose", () => {
    expect(toPosePoints(new Array(32).fill({ x: 0, y: 0, z: 0 }))).toBeNull();
    expect(toPosePoints(new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.8 }))).toHaveLength(33);
  });

  it("maps normalized coordinates to source pixels without guessing aspect ratio", () => {
    expect(toPixelCoordinate({ x: 0.25, y: 0.5 }, 1280, 720)).toEqual({
      x: 320,
      y: 360,
    });
  });

  it("counts only key joints above the engineering threshold", () => {
    const landmarks = makeLandmarks(0.9);
    expect(countVisibleKeyJoints(landmarks)).toBe(8);
    for (const index of KEY_JOINT_INDICES.slice(0, 4)) {
      landmarks[index].visibility = QUALITY_THRESHOLDS.keyJointVisible - 0.01;
    }
    expect(countVisibleKeyJoints(landmarks)).toBe(4);
  });

  it("computes mean visibility", () => {
    const landmarks = makeLandmarks(0.8);
    landmarks[0].visibility = 0;
    expect(averageVisibility(landmarks)).toBeCloseTo((32 * 0.8) / 33, 6);
    expect(averageVisibility(null)).toBe(0);
  });
});

describe("assessFraming", () => {
  it("reports a full frame when head, shoulders, knees and ankles are visible", () => {
    expect(assessFraming(makeLandmarks(0.9))).toBe("full");
  });

  it("detects lower-body cut-off in the original camera stream", () => {
    const landmarks = makeLandmarks(0.9);
    for (const index of [25, 26, 27, 28]) {
      landmarks[index].visibility = 0.1;
    }
    expect(assessFraming(landmarks)).toBe("lower-cut");
  });

  it("detects upper-body cut-off in the original camera stream", () => {
    const landmarks = makeLandmarks(0.9);
    for (const index of [0, 7, 8, 11, 12]) {
      landmarks[index].visibility = 0;
    }
    expect(assessFraming(landmarks)).toBe("upper-cut");
  });

  it("returns unknown without a complete pose", () => {
    expect(assessFraming(null)).toBe("unknown");
    expect(assessFraming(makeLandmarks(0.9).slice(0, 20))).toBe("unknown");
  });
});

describe("classifyPoseSignal", () => {
  it("marks a pose with enough key joints as okay", () => {
    const result = classifyPoseSignal(makeLandmarks(), 1000, 900);
    expect(result.signal).toBe("ok");
    expect(result.lostForMs).toBe(0);
  });

  it("marks a pose with too few key joints as partial", () => {
    const landmarks = makeLandmarks(0.9);
    for (const index of KEY_JOINT_INDICES.slice(0, 4)) {
      landmarks[index].visibility = 0.1;
    }
    expect(classifyPoseSignal(landmarks, 1000, 900).signal).toBe("partial");
  });

  it("gracefully handles a short loss and then reports lost", () => {
    expect(classifyPoseSignal(null, 1000, 800).signal).toBe("none");
    const lost = classifyPoseSignal(null, 1000, 300);
    expect(lost.signal).toBe("lost");
    expect(lost.lostForMs).toBe(700);
  });
});
