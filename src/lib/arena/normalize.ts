import { QUALITY_THRESHOLDS } from "../../config/constants";
import type {
  ArenaPreparedPair,
  NormalizedFrame,
  NormalizedPose,
} from "../../types/arena";
import type { GhostAction } from "../../types/ghost";
import type { PosePoint } from "../../types/pose";

/**
 * Normalize a single pose into a body-relative space:
 * - Origin at the hip midpoint (translation).
 * - Scale unit = torso length (shoulder-midpoint to hip-midpoint distance).
 * - x is aspect-corrected so horizontal and vertical scales are comparable.
 */
export function normalizePose(
  landmarks: readonly PosePoint[] | null,
  aspect: number,
): NormalizedPose[] | null {
  if (!landmarks || landmarks.length < 33) return null;
  if (!Number.isFinite(aspect) || aspect <= 0) return null;

  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  const visible = (i: number): PosePoint | null => {
    const p = landmarks[i];
    if (!p) return null;
    if (p.visibility < threshold) return null;
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1
    ) {
      return null;
    }
    return p;
  };

  const midpoint = (a: PosePoint | null, b: PosePoint | null) => {
    if (a && b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    return a ?? b;
  };

  const shoulderMid = midpoint(visible(11), visible(12));
  const hipMid = midpoint(visible(23), visible(24));

  // Anchor: prefer hip midpoint, fall back to shoulder midpoint.
  let anchorX: number;
  let anchorY: number;
  if (hipMid) {
    anchorX = hipMid.x * aspect;
    anchorY = hipMid.y;
  } else if (shoulderMid) {
    anchorX = shoulderMid.x * aspect;
    anchorY = shoulderMid.y;
  } else {
    // No reliable anchor — cannot normalize.
    return null;
  }

  // Scale: prefer torso length; fall back to shoulder width.
  let scaleLength = 0;
  if (shoulderMid && hipMid) {
    const dx = (shoulderMid.x - hipMid.x) * aspect;
    const dy = shoulderMid.y - hipMid.y;
    scaleLength = Math.sqrt(dx * dx + dy * dy);
  }
  if (scaleLength < 0.02) {
    const leftShoulder = visible(11);
    const rightShoulder = visible(12);
    if (leftShoulder && rightShoulder) {
      const dx = (leftShoulder.x - rightShoulder.x) * aspect;
      const dy = leftShoulder.y - rightShoulder.y;
      scaleLength = Math.sqrt(dx * dx + dy * dy);
    }
  }
  if (!Number.isFinite(scaleLength) || scaleLength < 0.02) {
    return null;
  }

  const result: NormalizedPose[] = landmarks.map((p) => ({
    nx: (p.x * aspect - anchorX) / scaleLength,
    ny: (p.y - anchorY) / scaleLength,
    z: p.z,
    visibility: p.visibility,
  }));

  return result;
}

/**
 * Normalize all valid frames of an action, returning only frames whose pose
 * normalized successfully.
 */
export function normalizeAction(
  action: GhostAction,
): NormalizedFrame[] {
  const aspect = action.capture.aspectRatio;
  const frames: NormalizedFrame[] = [];

  for (const frame of action.frames) {
    if (!frame.landmarks) continue;
    if (!frame.quality.valid) continue;
    const landmarks = normalizePose(frame.landmarks, aspect);
    if (!landmarks) continue;
    frames.push({ timestampMs: frame.timestampMs, landmarks });
  }

  return frames;
}

/**
 * Prepare two actions for comparison: normalize both sequences and run DTW.
 */
export function prepareArenaPair(
  reference: GhostAction,
  imitation: GhostAction,
  runDtw: (
    a: NormalizedFrame[],
    b: NormalizedFrame[],
  ) => import("../../types/arena").DtwResult,
): ArenaPreparedPair | null {
  const refFrames = normalizeAction(reference);
  const imitFrames = normalizeAction(imitation);
  if (refFrames.length === 0 || imitFrames.length === 0) return null;

  const alignment = runDtw(refFrames, imitFrames);

  // Per-joint differences after alignment (see scoring module for the report).
  const jointDiffs: ArenaPreparedPair["jointDiffs"] = [];

  return {
    reference,
    imitation,
    refFrames,
    imitFrames,
    alignment,
    jointDiffs,
  };
}