import { QUALITY_THRESHOLDS } from "../../config/constants";
import type {
  ArenaPreparedPair,
  ArenaQualityResult,
  ArenaScore,
  ArenaTimingMetrics,
  JointDifference,
  KeyMoment,
} from "../../types/arena";
import { computeTimingMetrics } from "./metrics";
import { computeJointDifferences, findKeyMoments } from "./differences";

/**
 * Scoring configuration. All parameters are deterministic, tunable, and
 * intentionally conservative — these produce a "fun" similarity index, not a
 * clinical measurement.
 */
const SCORE_PARAMS = {
  /**
   * Sensitivity of pose similarity to normalized distance. Higher values make
   * the score drop faster as the pose error grows.
   *
   * With k≈3: dtwCost=0.05 → 86, dtwCost=0.2 → 55, dtwCost=0.5 → 22.
   */
  poseSensitivity: 3.0,

  /** Maximum normalized cost that still produces a non-zero pose score. */
  poseCostCap: 1.5,

  /** Weight of duration match in timing similarity (remainder to rhythm). */
  durationWeight: 0.6,

  /** Weights for overall score. */
  overallPoseWeight: 0.55,
  overallTimingWeight: 0.30,
  overallCoverageWeight: 0.15,

  /** Minimum valid frames for scoring. */
  minValidFrames: 5,

  /** Minimum fraction of expected joints contributing to difference computation. */
  minJointCoverage: 0.3,

  /** Minimum motion amplitude (normalized units) to consider the action non-static. */
  minMotionAmplitude: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

/**
 * Check whether the pair passes all quality gates for meaningful scoring.
 * The quality result is separate from the numeric scores.
 */
export function checkArenaQuality(
  pair: ArenaPreparedPair,
): ArenaQualityResult {
  const reasons: string[] = [];
  const notes: string[] = [];
  const { reference, imitation, refFrames, imitFrames, alignment } = pair;

  // Valid frames
  if (refFrames.length < SCORE_PARAMS.minValidFrames) {
    reasons.push(`参考动作有效归一化帧不足 (${refFrames.length}/${SCORE_PARAMS.minValidFrames})。`);
  }
  if (imitFrames.length < SCORE_PARAMS.minValidFrames) {
    reasons.push(`复刻动作有效归一化帧不足 (${imitFrames.length}/${SCORE_PARAMS.minValidFrames})。`);
  }

  // DTW path
  if (alignment.path.length === 0) {
    reasons.push("DTW 对齐路径为空。");
  }

  // Joint coverage
  const jointCoverage = estimateJointCoverage(pair);
  if (jointCoverage < SCORE_PARAMS.minJointCoverage) {
    reasons.push(
      `关节可见覆盖率过低 (${(jointCoverage * 100).toFixed(0)}%/${(SCORE_PARAMS.minJointCoverage * 100).toFixed(0)}%)，关键点大量缺失。`,
    );
  }

  // Motion amplitude (avoid giving high scores to static poses)
  const amp = estimateMotionAmplitude(refFrames, imitFrames);
  if (amp < SCORE_PARAMS.minMotionAmplitude) {
    notes.push(`运动幅度极低 (${amp.toFixed(3)})，姿态评分可能虚高。`);
  }

  // Duration imbalance
  if (reference.durationMs > 0 && imitation.durationMs > 0) {
    const ratio = Math.max(reference.durationMs, imitation.durationMs) /
      Math.min(reference.durationMs, imitation.durationMs);
    if (ratio > 4) {
      notes.push(`两段动作时长差异超过 4 倍，DTW 对齐可能不可靠。`);
    }
  }

  // Key joint visibility
  for (const frame of [...refFrames, ...imitFrames]) {
    if (!frame.landmarks) continue;
    let visibleKey = 0;
    for (const idx of [11, 12, 23, 24]) {
      const p = frame.landmarks[idx];
      if (p && p.visibility >= QUALITY_THRESHOLDS.keyJointVisible) visibleKey += 1;
    }
    if (visibleKey < 2) {
      notes.push("部分关键关节（肩/髋）可见性偏低，关节距离计算可能不精确。");
      break;
    }
  }

  return {
    acceptable: reasons.length === 0,
    reasons,
    reviewNotes: notes,
  };
}

function estimateJointCoverage(pair: ArenaPreparedPair): number {
  const { refFrames, imitFrames, alignment } = pair;
  if (alignment.path.length === 0) return 0;

  let covered = 0;
  let total = 0;

  for (const step of alignment.path) {
    const ref = refFrames[step.i];
    const imit = imitFrames[step.j];
    if (!ref?.landmarks || !imit?.landmarks) continue;

    for (let k = 0; k < ref.landmarks.length; k += 1) {
      total += 1;
      const rp = ref.landmarks[k];
      const ip = imit.landmarks[k];
      if (
        rp && ip &&
        rp.visibility >= QUALITY_THRESHOLDS.landmarkVisible &&
        ip.visibility >= QUALITY_THRESHOLDS.landmarkVisible
      ) {
        covered += 1;
      }
    }
  }

  return total > 0 ? covered / total : 0;
}

function estimateMotionAmplitude(
  refFrames: readonly { landmarks: { nx: number; ny: number; visibility: number }[] | null }[],
  _imitFrames: readonly { landmarks: { nx: number; ny: number; visibility: number }[] | null }[],
): number {
  // Use the reference: compute total displacement of hip midpoint across frames
  let totalDisplacement = 0;
  let prevHip: { nx: number; ny: number } | null = null;

  for (const frame of refFrames) {
    if (!frame.landmarks) continue;
    const hip = frame.landmarks[23];
    if (!hip || hip.visibility < QUALITY_THRESHOLDS.landmarkVisible) continue;
    if (prevHip) {
      totalDisplacement += Math.sqrt(
        (hip.nx - prevHip.nx) ** 2 + (hip.ny - prevHip.ny) ** 2,
      );
    }
    prevHip = hip;
  }

  return totalDisplacement;
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

/**
 * Map a normalized distance to a [0,1] similarity using an exponential decay
 * with a hard cap.
 */
function distanceToSimilarity(distance: number): number {
  const capped = Math.min(distance, SCORE_PARAMS.poseCostCap);
  return Math.exp(-SCORE_PARAMS.poseSensitivity * capped);
}

/**
 * Compute the full Arena score for a prepared pair.
 */
export function computeArenaScore(pair: ArenaPreparedPair): ArenaScore {
  const { refFrames, imitFrames, alignment, reference, imitation } = pair;

  // --- Pose similarity (0-100) ---
  const rawSimilarity = distanceToSimilarity(alignment.normalizedCost);
  const poseSimilarity = Math.round(rawSimilarity * 100);

  // --- Timing metrics ---
  const timing = computeTimingMetrics(reference, imitation, alignment);
  const durationSimilarity = 1 - timing.relativeDiff;
  const timingRaw =
    SCORE_PARAMS.durationWeight * durationSimilarity +
    (1 - SCORE_PARAMS.durationWeight) * timing.rhythmSimilarity;
  const timingSimilarity = Math.round(Math.max(0, timingRaw) * 100);

  // --- Joint differences ---
  const jointDiffs = computeJointDifferences(
    refFrames,
    imitFrames,
    alignment.path,
    reference.mode,
  );

  // --- Key moments ---
  const keyMoments = findKeyMoments(refFrames, imitFrames, alignment.path);

  // --- Coverage (fraction of successful joint measurements) ---
  const coverage = estimateJointCoverage(pair);

  // --- Overall match (0-100) ---
  const overallRaw =
    SCORE_PARAMS.overallPoseWeight * rawSimilarity +
    SCORE_PARAMS.overallTimingWeight * timingRaw +
    SCORE_PARAMS.overallCoverageWeight * coverage;
  const overallMatch = Math.round(Math.max(0, Math.min(1, overallRaw)) * 100);

  // --- Quality ---
  const quality = checkArenaQuality(pair);

  // --- Explanation ---
  const explanation = buildExplanation(
    poseSimilarity,
    timingSimilarity,
    overallMatch,
    timing,
    quality,
    alignment,
    jointDiffs,
    keyMoments,
  );

  return {
    poseSimilarity,
    timingSimilarity,
    overallMatch,
    jointDifferences: jointDiffs,
    keyMoments,
    quality,
    explanation,
  };
}

function buildExplanation(
  pose: number,
  timing: number,
  overall: number,
  timingMetrics: ArenaTimingMetrics,
  quality: ArenaQualityResult,
  alignment: { normalizedCost: number; pathLength: number },
  jointDiffs: JointDifference[],
  keyMoments: KeyMoment[],
): string {
  const lines: string[] = [];

  lines.push(
    `姿态相似度 ${pose}/100（基于归一化 DTW 距离 ${alignment.normalizedCost.toFixed(3)}，路径长度 ${alignment.pathLength}）。`,
  );
  lines.push(
    `时间相似度 ${timing}/100（时长比 ${(1 - timingMetrics.relativeDiff).toFixed(2)}，节律相似 ${timingMetrics.rhythmSimilarity.toFixed(2)}；${timingMetrics.note}）。`,
  );

  if (jointDiffs.length > 0) {
    const top = jointDiffs[0];
    lines.push(
      `差异最大关节：${top.labelZh || `#${top.landmarkIndex}`}（均值 ${top.meanDistance.toFixed(3)}，峰值 ${top.maxDistance.toFixed(3)}）。`,
    );
  }

  if (keyMoments.length > 0) {
    const worst = keyMoments[0];
    lines.push(
      `差异最大时段：${(worst.startMs / 1000).toFixed(1)}s–${(worst.endMs / 1000).toFixed(1)}s（均值 ${worst.meanDistance.toFixed(3)}，峰值 ${worst.peakDistance.toFixed(3)}）。`,
    );
  }

  if (!quality.acceptable) {
    lines.push(`⚠️ 质量门未通过：${quality.reasons.join("；")}`);
  }
  for (const note of quality.reviewNotes) {
    lines.push(`📋 ${note}`);
  }

  lines.push(`总体评分 ${overall}/100。本评分为趣味指标，未经临床验证。`);
  return lines.join("\n");
}