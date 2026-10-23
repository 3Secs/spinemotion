import type { DtwResult, NormalizedFrame } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";
import type { PosePoint } from "../../types/pose";
import { sampleGhostAction } from "../ghost/playback";
import { normalizePose } from "./normalize";

export type ComparisonMode = "original" | "dtw";

/** Normalized (body-relative) landmark for overlay drawing. */
export interface NormPoint {
  nx: number;
  ny: number;
  z: number;
  visibility: number;
}

export interface ComparisonFrame {
  /** Playback progress in [0,1]. */
  progress: number;
  refTimeMs: number;
  imitTimeMs: number;
  /** Original MediaPipe normalized landmarks (side-by-side drawing). */
  refLandmarks: PosePoint[] | null;
  imitLandmarks: PosePoint[] | null;
  /** Body-relative normalized landmarks (overlay drawing). */
  refNorm: NormPoint[] | null;
  imitNorm: NormPoint[] | null;
  refGap: boolean;
  imitGap: boolean;
}

export interface ComparisonSampler {
  (progress: number): ComparisonFrame;
  durationMs: number;
  mode: ComparisonMode;
}

/**
 * Build a sampler that maps playback progress → aligned frame pair.
 *
 * - original: both actions advance on their own wall-clock timestamps.
 * - dtw: progress traverses the DTW path, so aligned poses are shown together.
 */
export function createComparisonSampler(
  reference: GhostAction,
  imitation: GhostAction,
  mode: ComparisonMode,
  refNormFrames: readonly NormalizedFrame[],
  imitNormFrames: readonly NormalizedFrame[],
  alignment: DtwResult,
): ComparisonSampler {
  const refAspect = reference.capture.aspectRatio;
  const imitAspect = imitation.capture.aspectRatio;

  if (mode === "dtw" && alignment.path.length > 0) {
    const path = alignment.path;
    const maxIndex = path.length - 1;

    const sampler = (progress: number): ComparisonFrame => {
      const clamped = Math.min(1, Math.max(0, progress));
      const stepIndex = Math.round(clamped * maxIndex);
      const step = path[stepIndex];
      const refF = refNormFrames[step.i];
      const imitF = imitNormFrames[step.j];

      const refTimeMs = refF?.timestampMs ?? 0;
      const imitTimeMs = imitF?.timestampMs ?? 0;

      // Original landmarks via wall-clock sampling for side-by-side view.
      const refOrig = sampleGhostAction(reference, refTimeMs).landmarks;
      const imitOrig = sampleGhostAction(imitation, imitTimeMs).landmarks;

      return {
        progress: clamped,
        refTimeMs,
        imitTimeMs,
        refLandmarks: refOrig,
        imitLandmarks: imitOrig,
        refNorm: refF?.landmarks ?? null,
        imitNorm: imitF?.landmarks ?? null,
        refGap: !refF?.landmarks,
        imitGap: !imitF?.landmarks,
      };
    };
    sampler.durationMs = Math.max(reference.durationMs, imitation.durationMs);
    sampler.mode = mode;
    return sampler;
  }

  // Original-time mode
  const durationMs = Math.max(reference.durationMs, imitation.durationMs);
  const sampler = (progress: number): ComparisonFrame => {
    const clamped = Math.min(1, Math.max(0, progress));
    const t = clamped * durationMs;
    const refSample = sampleGhostAction(reference, t);
    const imitSample = sampleGhostAction(imitation, t);

    return {
      progress: clamped,
      refTimeMs: refSample.timeMs,
      imitTimeMs: imitSample.timeMs,
      refLandmarks: refSample.landmarks,
      imitLandmarks: imitSample.landmarks,
      refNorm: normalizePose(refSample.landmarks, refAspect),
      imitNorm: normalizePose(imitSample.landmarks, imitAspect),
      refGap: refSample.status === "gap" || refSample.landmarks === null,
      imitGap: imitSample.status === "gap" || imitSample.landmarks === null,
    };
  };
  sampler.durationMs = durationMs;
  sampler.mode = mode;
  return sampler;
}
