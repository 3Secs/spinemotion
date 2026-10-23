import { QUALITY_THRESHOLDS } from "../../config/constants";
import type {
  GhostAction,
  GhostBodyCalibration,
  GhostCalibration,
} from "../../types/ghost";
import type {
  CaptureMode,
  PosePoint,
} from "../../types/pose";

interface XY {
  x: number;
  y: number;
}

function visiblePoint(
  landmarks: readonly PosePoint[] | null,
  index: number,
  threshold: number,
): PosePoint | null {
  const point = landmarks?.[index];
  if (!point) return null;
  if (point.visibility < threshold) return null;
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.x > 1 ||
    point.y < 0 ||
    point.y > 1
  ) {
    return null;
  }
  return point;
}

function midpoint(points: readonly PosePoint[]): XY | null {
  if (points.length === 0) return null;
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function distance(a: XY, b: XY, aspect: number): number {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute a body-relative calibration from a single pose.
 *
 * Coordinates are converted to an aspect-corrected body space (x * aspect, y)
 * before distances are measured. A fixed recording-level calibration is used
 * for the reference; the live calibration may follow the current body.
 */
export function computeBodyCalibration(
  landmarks: readonly PosePoint[] | null,
  mode: CaptureMode,
  aspect: number,
  threshold = QUALITY_THRESHOLDS.landmarkVisible,
): GhostBodyCalibration | null {
  if (!landmarks || landmarks.length < 33 || !Number.isFinite(aspect) || aspect <= 0) {
    return null;
  }

  const shoulders = [11, 12]
    .map((index) => visiblePoint(landmarks, index, threshold))
    .filter((point): point is PosePoint => point !== null);
  const hips = [23, 24]
    .map((index) => visiblePoint(landmarks, index, threshold))
    .filter((point): point is PosePoint => point !== null);

  const shoulderMid = midpoint(shoulders);
  const hipMid = midpoint(hips);
  let anchor: XY | null = null;
  let scale = 0;

  if (shoulderMid && hipMid) {
    anchor = hipMid;
    scale = distance(shoulderMid, hipMid, aspect);
  } else if (shoulders.length === 2) {
    anchor = shoulderMid;
    scale = distance(shoulders[0], shoulders[1], aspect);
  } else if (hips.length === 2) {
    anchor = hipMid;
    scale = distance(hips[0], hips[1], aspect);
  } else if (mode === "upper-body" && shoulderMid) {
    anchor = shoulderMid;
  }

  if (!anchor || !Number.isFinite(scale) || scale < 0.005) {
    return null;
  }

  return {
    anchorX: anchor.x * aspect,
    anchorY: anchor.y,
    scale,
    aspect,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Recording-level reference calibration. Using the median avoids letting one
 * bad pose shift the entire ghost, while preserving body-relative motion.
 */
export function computeReferenceCalibration(
  action: GhostAction,
): GhostBodyCalibration | null {
  const calibrations: GhostBodyCalibration[] = [];
  for (const frame of action.frames) {
    const calibration = computeBodyCalibration(
      frame.landmarks,
      action.mode,
      action.capture.aspectRatio,
    );
    if (calibration) calibrations.push(calibration);
  }
  if (calibrations.length === 0) return null;

  return {
    anchorX: median(calibrations.map((item) => item.anchorX)),
    anchorY: median(calibrations.map((item) => item.anchorY)),
    scale: median(calibrations.map((item) => item.scale)),
    aspect: action.capture.aspectRatio,
  };
}

export interface GhostTransformOptions {
  reference: GhostBodyCalibration;
  current: GhostBodyCalibration;
  manual: GhostCalibration;
  referenceMirrored: boolean;
  currentMirrored: boolean;
}

/**
 * Raw MediaPipe normalized → aspect-corrected body-relative → current camera
 * normalized display coordinates. The live body anchor/scale defines the
 * placement, so two people can stand in different positions.
 */
export function transformNormalizedPoint(
  point: Pick<PosePoint, "x" | "y">,
  options: GhostTransformOptions,
): XY {
  const { reference, current, manual } = options;
  const flipReference = options.referenceMirrored !== options.currentMirrored;
  const referenceAspect = reference.aspect;

  let sourceX = point.x * referenceAspect;
  if (flipReference) {
    sourceX = referenceAspect - sourceX;
  }
  const anchorX = flipReference
    ? referenceAspect - reference.anchorX
    : reference.anchorX;

  const scaleRatio =
    (current.scale / reference.scale) *
    Math.max(0.3, Math.min(2, manual.scale));
  const bodyX = (sourceX - anchorX) * scaleRatio;
  const bodyY = (point.y - reference.anchorY) * scaleRatio;

  let displayX =
    (current.anchorX + bodyX) / current.aspect +
    manual.offsetX;
  const displayY = current.anchorY + bodyY + manual.offsetY;

  if (options.currentMirrored) {
    displayX = 1 - displayX;
  }

  return { x: displayX, y: displayY };
}

export function transformLandmarks(
  landmarks: readonly PosePoint[],
  options: GhostTransformOptions,
): PosePoint[] {
  return landmarks.map((point) => {
    const transformed = transformNormalizedPoint(point, options);
    return {
      ...point,
      x: transformed.x,
      y: transformed.y,
      z: point.z,
    };
  });
}
