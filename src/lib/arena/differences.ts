import { QUALITY_THRESHOLDS } from "../../config/constants";
import { LANDMARK_LABELS_ZH } from "../../config/constants";
import type {
  DtwStep,
  JointDifference,
  KeyMoment,
  NormalizedFrame,
} from "../../types/arena";
import { jointIndicesForMode } from "./joints";
import type { CaptureMode } from "../../types/pose";

/**
 * Euclidean distance in normalized space between two normalized landmarks.
 */
function normDist(
  a: { nx: number; ny: number; z: number },
  b: { nx: number; ny: number; z: number },
): number {
  const dx = a.nx - b.nx;
  const dy = a.ny - b.ny;
  const dz = (a.z - b.z) * 0.5;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Compute per-joint mean and max distance along the DTW alignment path.
 * Only frame pairs where BOTH landmarks are sufficiently visible contribute.
 */
export function computeJointDifferences(
  refFrames: readonly NormalizedFrame[],
  imitFrames: readonly NormalizedFrame[],
  path: readonly DtwStep[],
  mode: CaptureMode,
): JointDifference[] {
  const indices = jointIndicesForMode(mode);
  const threshold = QUALITY_THRESHOLDS.landmarkVisible;

  // Accumulators per index
  const sums = new Float64Array(33).fill(0);
  const maxes = new Float64Array(33).fill(0);
  const counts = new Uint32Array(33).fill(0);

  for (const step of path) {
    const ref = refFrames[step.i];
    const imit = imitFrames[step.j];
    if (!ref?.landmarks || !imit?.landmarks) continue;

    for (const idx of indices) {
      const rp = ref.landmarks[idx];
      const ip = imit.landmarks[idx];
      if (!rp || !ip) continue;
      if (rp.visibility < threshold || ip.visibility < threshold) continue;

      const d = normDist(rp, ip);
      sums[idx] += d;
      if (d > maxes[idx]) maxes[idx] = d;
      counts[idx] += 1;
    }
  }

  // Build sorted result
  const diffs: JointDifference[] = indices
    .filter((idx) => counts[idx] > 0)
    .map((idx) => ({
      landmarkIndex: idx,
      label: `landmark-${idx}`,
      labelZh: LANDMARK_LABELS_ZH[idx] ?? `关键点 ${idx}`,
      meanDistance: sums[idx] / counts[idx],
      maxDistance: maxes[idx],
      sampleCount: counts[idx],
    }))
    .sort((a, b) => b.meanDistance - a.meanDistance);

  return diffs;
}

/**
 * Identify the time segments with the largest aligned pose error.
 * Uses a sliding window over the DTW path.
 */
export function findKeyMoments(
  refFrames: readonly NormalizedFrame[],
  imitFrames: readonly NormalizedFrame[],
  path: readonly DtwStep[],
  maxMoments = 3,
): KeyMoment[] {
  if (path.length === 0 || refFrames.length === 0) return [];

  // Compute per-step aggregate distance
  const errors: number[] = [];
  const times: number[] = [];

  for (const step of path) {
    const ref = refFrames[step.i];
    const imit = imitFrames[step.j];
    if (!ref?.landmarks || !imit?.landmarks) {
      errors.push(0);
      times.push(ref ? ref.timestampMs : 0);
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let k = 0; k < ref.landmarks.length && k < imit.landmarks.length; k += 1) {
      const rp = ref.landmarks[k];
      const ip = imit.landmarks[k];
      if (!rp || !ip) continue;
      if (rp.visibility < QUALITY_THRESHOLDS.landmarkVisible) continue;
      if (ip.visibility < QUALITY_THRESHOLDS.landmarkVisible) continue;
      sum += normDist(rp, ip);
      count += 1;
    }
    errors.push(count > 0 ? sum / count : 0);
    times.push(ref.timestampMs);
  }

  // Sliding window: find max-error contiguous regions
  const windowSize = Math.max(3, Math.floor(path.length / 8));

  const moments: KeyMoment[] = [];
  const used = new Set<number>();

  for (let attempt = 0; attempt < maxMoments; attempt += 1) {
    let bestStart = 0;
    let bestMean = 0;
    let bestPeak = 0;

    for (let start = 0; start + windowSize <= path.length; start += 1) {
      // Skip overlapping with already-selected moments
      let overlaps = false;
      for (let k = start; k < start + windowSize; k += 1) {
        if (used.has(k)) { overlaps = true; break; }
      }
      if (overlaps) continue;

      let sum = 0;
      let peak = 0;
      for (let k = start; k < start + windowSize; k += 1) {
        sum += errors[k];
        if (errors[k] > peak) peak = errors[k];
      }
      const mean = sum / windowSize;
      if (mean > bestMean) {
        bestMean = mean;
        bestPeak = peak;
        bestStart = start;
      }
    }

    if (bestMean <= 0) break;

    moments.push({
      startMs: times[bestStart],
      endMs: times[Math.min(bestStart + windowSize - 1, times.length - 1)],
      meanDistance: bestMean,
      peakDistance: bestPeak,
    });

    for (let k = bestStart; k < bestStart + windowSize; k += 1) {
      used.add(k);
    }
  }

  return moments;
}