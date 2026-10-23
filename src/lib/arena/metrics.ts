import type { ArenaTimingMetrics, DtwResult } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";

/**
 * Compute timing and rhythm metrics for a pair of actions.
 *
 * Rhythm is estimated by comparing the per-frame motion speed profiles of the
 * two actions along the DTW path. A high correlation means the actions speed
 * up and slow down at similar points in their respective timelines.
 */
export function computeTimingMetrics(
  reference: GhostAction,
  imitation: GhostAction,
  alignment: DtwResult,
): ArenaTimingMetrics {
  const refDurationMs = reference.durationMs;
  const imitDurationMs = imitation.durationMs;
  const absoluteDiffMs = Math.abs(refDurationMs - imitDurationMs);
  const relativeDiff =
    Math.max(refDurationMs, imitDurationMs) > 0
      ? absoluteDiffMs / Math.max(refDurationMs, imitDurationMs)
      : 0;

  // Build speed profiles: for each aligned pair, compute the displacement
  // from the previous aligned frame (using raw landmarks for simplicity).
  const rhythm = computeRhythm(reference, imitation, alignment);

  return {
    refDurationMs,
    imitDurationMs,
    absoluteDiffMs,
    relativeDiff,
    rhythmSimilarity: rhythm.similarity,
    hasRhythm: rhythm.hasMotion,
    note: rhythm.note,
  };
}

interface RhythmResult {
  similarity: number;
  hasMotion: boolean;
  note: string;
}

function pointDistance(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz * 0.25);
}

/**
 * Compute local motion speed (average landmark displacement) between two
 * consecutive frames. If either frame is null, returns 0.
 */
function frameSpeed(
  action: GhostAction,
  index: number,
): number {
  const frames = action.frames;
  if (index <= 0 || index >= frames.length) return 0;
  const prev = frames[index - 1];
  const cur = frames[index];
  if (!prev?.landmarks || !cur?.landmarks) return 0;

  let sum = 0;
  let count = 0;
  for (let k = 0; k < prev.landmarks.length; k += 1) {
    const pp = prev.landmarks[k];
    const cp = cur.landmarks[k];
    if (pp.visibility < 0.35 || cp.visibility < 0.35) continue;
    sum += pointDistance(pp, cp);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function computeRhythm(
  reference: GhostAction,
  imitation: GhostAction,
  alignment: DtwResult,
): RhythmResult {
  const path = alignment.path;
  if (path.length < 3) {
    return {
      similarity: 0,
      hasMotion: false,
      note: "对齐路径过短，无法评估节律。",
    };
  }

  // Sample speed at each aligned position
  const refSpeeds: number[] = [];
  const imitSpeeds: number[] = [];

  for (const step of path) {
    refSpeeds.push(frameSpeed(reference, step.i));
    imitSpeeds.push(frameSpeed(imitation, step.j));
  }

  const refTotal = refSpeeds.reduce((s, v) => s + v, 0);
  const imitTotal = imitSpeeds.reduce((s, v) => s + v, 0);

  if (refTotal < 1e-6 && imitTotal < 1e-6) {
    return {
      similarity: 1, // both motionless — trivially same rhythm
      hasMotion: false,
      note: "两段动作均几乎静止，无法评估节律。",
    };
  }

  if (refTotal < 1e-6 || imitTotal < 1e-6) {
    return {
      similarity: 0,
      hasMotion: true,
      note: "一段动作静止而另一段有运动，节律不可比。",
    };
  }

  // Compute Pearson correlation between the two speed series
  const refMean = refTotal / refSpeeds.length;
  const imitMean = imitTotal / imitSpeeds.length;
  let cov = 0;
  let refVar = 0;
  let imitVar = 0;

  for (let k = 0; k < refSpeeds.length; k += 1) {
    const dr = refSpeeds[k] - refMean;
    const di = imitSpeeds[k] - imitMean;
    cov += dr * di;
    refVar += dr * dr;
    imitVar += di * di;
  }

  const denom = Math.sqrt(refVar * imitVar);
  if (denom < 1e-10) {
    return {
      similarity: 0,
      hasMotion: true,
      note: "速度波动过小，无法可靠评估节律。",
    };
  }

  const r = cov / denom;
  const similarity = Math.max(0, Math.min(1, (r + 1) / 2));

  let note: string;
  if (r > 0.7) note = "两段动作速度节奏高度一致。";
  else if (r > 0.3) note = "两段动作速度节奏中等相关。";
  else note = "两段动作速度节奏差异明显。";

  return { similarity, hasMotion: true, note };
}