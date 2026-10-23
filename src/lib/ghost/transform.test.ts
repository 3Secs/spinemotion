import { describe, expect, it } from "vitest";
import {
  computeBodyCalibration,
  computeReferenceCalibration,
  transformLandmarks,
  transformNormalizedPoint,
} from "./transform";
import { makeAction, makeFrame, makeLandmarks } from "./testFixtures";
import { DEFAULT_GHOST_CALIBRATION } from "../../types/ghost";

describe("body-relative calibration", () => {
  it("uses the hip anchor and torso length for a full pose", () => {
    const calibration = computeBodyCalibration(makeLandmarks(), "full-body", 2);
    expect(calibration).not.toBeNull();
    if (!calibration) return;
    expect(calibration.anchorX).toBeCloseTo(1, 5);
    expect(calibration.anchorY).toBeCloseTo(0.62, 5);
    expect(calibration.scale).toBeCloseTo(0.27, 5);
    expect(calibration.aspect).toBe(2);
  });

  it("falls back to shoulder width for upper body when hips are hidden", () => {
    const landmarks = makeLandmarks();
    landmarks[23].visibility = 0;
    landmarks[24].visibility = 0;
    const calibration = computeBodyCalibration(landmarks, "upper-body", 2);
    expect(calibration).not.toBeNull();
    if (!calibration) return;
    expect(calibration.anchorY).toBeCloseTo(0.35, 5);
    expect(calibration.scale).toBeCloseTo(0.4, 5);
  });

  it("returns null without enough torso information", () => {
    const landmarks = makeLandmarks();
    for (const index of [11, 12, 23, 24]) landmarks[index].visibility = 0;
    expect(computeBodyCalibration(landmarks, "full-body", 2)).toBeNull();
  });

  it("computes a stable recording-level calibration", () => {
    const action = makeAction();
    const calibration = computeReferenceCalibration(action);
    expect(calibration).not.toBeNull();
    if (!calibration) return;
    expect(calibration.aspect).toBeCloseTo(1280 / 720, 6);
    expect(calibration.scale).toBeGreaterThan(0);
  });
});

describe("coordinate transformation", () => {
  const reference = {
    anchorX: 1,
    anchorY: 0.62,
    scale: 0.27,
    aspect: 2,
  };

  it("is an identity when both bodies have the same calibration", () => {
    const point = { x: 0.4, y: 0.35 };
    const output = transformNormalizedPoint(point, {
      reference,
      current: reference,
      manual: DEFAULT_GHOST_CALIBRATION,
      referenceMirrored: false,
      currentMirrored: false,
    });
    expect(output.x).toBeCloseTo(0.4, 6);
    expect(output.y).toBeCloseTo(0.35, 6);
  });

  it("moves the ghost to a different current body position", () => {
    const current = {
      anchorX: 1.2,
      anchorY: 0.7,
      scale: 0.54,
      aspect: 2,
    };
    const output = transformNormalizedPoint(
      { x: 0.6, y: 0.35 },
      {
        reference,
        current,
        manual: DEFAULT_GHOST_CALIBRATION,
        referenceMirrored: false,
        currentMirrored: false,
      },
    );
    expect(output.x).toBeCloseTo(0.8, 6);
    expect(output.y).toBeCloseTo(0.7 + (0.35 - 0.62) * 2, 6);
  });

  it("applies manual normalized offsets and scale", () => {
    const output = transformNormalizedPoint(
      { x: 0.4, y: 0.35 },
      {
        reference,
        current: reference,
        manual: { offsetX: 0.05, offsetY: -0.02, scale: 1.2 },
        referenceMirrored: false,
        currentMirrored: false,
      },
    );
    expect(output.x).toBeCloseTo(0.43, 6);
    expect(output.y).toBeCloseTo(0.62 + (0.35 - 0.62) * 1.2 - 0.02, 6);
  });

  it("mirrors a reference recorded under the opposite mirror direction", () => {
    const output = transformNormalizedPoint(
      { x: 0.4, y: 0.35 },
      {
        reference: { ...reference, aspect: 2 },
        current: { ...reference, aspect: 2 },
        manual: DEFAULT_GHOST_CALIBRATION,
        referenceMirrored: true,
        currentMirrored: false,
      },
    );
    expect(output.x).toBeCloseTo(0.6, 6);
  });

  it("maps all 33 points while preserving quality fields", () => {
    const landmarks = makeLandmarks();
    const transformed = transformLandmarks(landmarks, {
      reference,
      current: reference,
      manual: { offsetX: 0.1, offsetY: 0, scale: 1 },
      referenceMirrored: false,
      currentMirrored: false,
    });
    expect(transformed).toHaveLength(33);
    expect(transformed[11].visibility).toBe(0.95);
    expect(transformed[11].presence).toBe(0.9);
    expect(transformed[11].x).toBeCloseTo(0.5, 6);
  });

  it("handles different source aspect ratios with body-space scaling", () => {
    const current = {
      anchorX: 1.5,
      anchorY: 0.6,
      scale: 0.3,
      aspect: 3,
    };
    const output = transformNormalizedPoint(
      { x: 0.6, y: 0.35 },
      {
        reference,
        current,
        manual: DEFAULT_GHOST_CALIBRATION,
        referenceMirrored: false,
        currentMirrored: false,
      },
    );
    expect(output.x).toBeCloseTo(0.574074, 5);
    expect(output.y).toBeCloseTo(0.6 + (0.35 - 0.62) * (0.3 / 0.27), 6);
  });

  it("prefers the subset of valid frames when frames are missing", () => {
    const action = makeAction({
      frames: [makeFrame(0, makeLandmarks()), makeFrame(100, null)],
    });
    expect(computeReferenceCalibration(action)).not.toBeNull();
  });
});
