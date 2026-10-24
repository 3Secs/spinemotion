import { QUALITY_THRESHOLDS } from "../../config/constants";
import type {
  ArenaPreparedPair,
  ArenaQualityResult,
  ArenaScore,
  JointDifference,
  KeyMoment,
} from "../../types/arena";
import { computeTimingMetrics } from "./metrics";
import { computeJointDifferences, findKeyMoments } from "./differences";

export type ArenaScoreMode = "casual" | "research";

// ---------------------------------------------------------------------------
// Per-mode calibration parameters
// ---------------------------------------------------------------------------

interface ScoreParams {
  /** Sensitivity k for exp(-k·d) mapping. */
  poseSensitivity: number;
  /** Capped maximum distance for exp decay. */
  poseCostCap: number;
  /** Duration weight (1 – durationWeight = rhythm weight). */
  durationWeight: number;
  /** Weights for overall. */
  overallPoseWeight: number;
  overallTimingWeight: number;
  overallCoverageWeight: number;
  /** Minimum valid frames. */
  minValidFrames: number;
  minJointCoverage: number;
  minMotionAmplitude: number;
  /** Whether to down-weight distal landmarks in the pose cost. */
  useJointWeights: boolean;
  /** Boost mid-range rhythm with sqrt so Pearson 0.5→0.71 not 0.75. */
  softRhythm: boolean;
}

const MODE_PARAMS: Record<ArenaScoreMode, ScoreParams> = {
  casual: {
    poseSensitivity: 1.5,
    poseCostCap: 1.5,
    durationWeight: 0.7,
    overallPoseWeight: 0.55,
    overallTimingWeight: 0.30,
    overallCoverageWeight: 0.15,
    minValidFrames: 5,
    minJointCoverage: 0.25,
    minMotionAmplitude: 0.02,
    useJointWeights: true,
    softRhythm: true,
  },
  research: {
    poseSensitivity: 3.0,
    poseCostCap: 1.5,
    durationWeight: 0.6,
    overallPoseWeight: 0.55,
    overallTimingWeight: 0.30,
    overallCoverageWeight: 0.15,
    minValidFrames: 5,
    minJointCoverage: 0.30,
    minMotionAmplitude: 0.05,
    useJointWeights: false,
    softRhythm: false,
  },
};

// ---------------------------------------------------------------------------
// Landmark weights for casual mode (distal noisy points reduced)
// ---------------------------------------------------------------------------

/** Landmark weight by index. Weight 1 = full; <1 = down-weighted. */
const CASUAL_LANDMARK_WEIGHTS: readonly number[] = (() => {
  const weights = new Array(33).fill(1.0);
  // Face (0-10): slightly down-weighted
  for (let i = 0; i <= 10; i += 1) weights[i] = 0.6;
  // Shoulders, torso, hips: keep 1.0 (indices 11-12, 23-24)
  // Elbows: 0.75
  weights[13] = weights[14] = 0.75;
  // Wrists: 0.5
  weights[15] = weights[16] = 0.5;
  // Fingers/pinky/index/thumb (17-22): 0.3
  for (let i = 17; i <= 22; i += 1) weights[i] = 0.3;
  // Knees: 0.8
  weights[25] = weights[26] = 0.8;
  // Ankles: 0.7
  weights[27] = weights[28] = 0.7;
  // Heels/feet (29-32): 0.5
  for (let i = 29; i <= 32; i += 1) weights[i] = 0.5;
  return weights;
})();

// ---------------------------------------------------------------------------
// Weighted pose cost
// ---------------------------------------------------------------------------

/**
 * Compute a weighted mean distance along the DTW alignment path.
 * In casual mode, distal landmarks (wrists, fingers, face) get lower weight
 * to reduce their impact on the score.
 */
function computeWeightedPoseCost(
  refFrames: readonly { landmarks: { nx: number; ny: number; z: number; visibility: number }[] | null }[],
  imitFrames: readonly { landmarks: { nx: number; ny: number; z: number; visibility: number }[] | null }[],
  path: readonly { i: number; j: number }[],
  weights: readonly number[],
): number {
  if (path.length === 0) return 1;

  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  let totalWeightedDist = 0;
  let totalWeight = 0;

  for (const step of path) {
    const ref = refFrames[step.i];
    const imit = imitFrames[step.j];
    if (!ref?.landmarks || !imit?.landmarks) continue;

    for (let k = 0; k < Math.min(ref.landmarks.length, imit.landmarks.length); k += 1) {
      const rp = ref.landmarks[k];
      const ip = imit.landmarks[k];
      if (!rp || !ip) continue;
      if (rp.visibility < threshold || ip.visibility < threshold) continue;

      const dx = rp.nx - ip.nx;
      const dy = rp.ny - ip.ny;
      const dz = (rp.z - ip.z) * 0.5;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const w = weights[k] ?? 1;
      totalWeightedDist += d * w;
      totalWeight += w;
    }
  }

  return totalWeight > 0 ? totalWeightedDist / totalWeight : 1;
}

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

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
      if (rp && ip && rp.visibility >= QUALITY_THRESHOLDS.landmarkVisible && ip.visibility >= QUALITY_THRESHOLDS.landmarkVisible) {
        covered += 1;
      }
    }
  }
  return total > 0 ? covered / total : 0;
}

function estimateMotionAmplitude(pair: ArenaPreparedPair): number {
  // Measure average displacement of ALL visible landmarks across consecutive
  // frames (original coordinates). Hip-only measurement under-reported
  // upper-body actions where the hip stays still, falsely reporting 0.000.
  const frames = pair.reference.frames;
  let totalDisplacement = 0;
  let prevLandmarks: { x: number; y: number; visibility: number }[] | null = null;

  for (const frame of frames) {
    if (!frame.landmarks) {
      prevLandmarks = null;
      continue;
    }
    const cur = frame.landmarks;
    if (prevLandmarks) {
      let stepSum = 0;
      let count = 0;
      const prev = prevLandmarks;
      for (let k = 0; k < prev.length && k < cur.length; k += 1) {
        const pp = prev[k];
        const cp = cur[k];
        if (!pp || !cp) continue;
        if (pp.visibility < QUALITY_THRESHOLDS.landmarkVisible || cp.visibility < QUALITY_THRESHOLDS.landmarkVisible) continue;
        stepSum += Math.sqrt((cp.x - pp.x) ** 2 + (cp.y - pp.y) ** 2);
        count += 1;
      }
      if (count > 0) totalDisplacement += stepSum / count;
    }
    prevLandmarks = cur;
  }
  return totalDisplacement;
}

export function checkArenaQuality(pair: ArenaPreparedPair, mode: ArenaScoreMode): ArenaQualityResult {
  const params = MODE_PARAMS[mode];
  const reasons: string[] = [];
  const notes: string[] = [];
  const { reference, imitation, refFrames, imitFrames, alignment } = pair;

  if (refFrames.length < params.minValidFrames) {
    reasons.push(`参考动作有效归一化帧不足 (${refFrames.length}/${params.minValidFrames})。`);
  }
  if (imitFrames.length < params.minValidFrames) {
    reasons.push(`复刻动作有效归一化帧不足 (${imitFrames.length}/${params.minValidFrames})。`);
  }
  if (alignment.path.length === 0) {
    reasons.push("DTW 对齐路径为空。");
  }

  const jointCoverage = estimateJointCoverage(pair);
  if (jointCoverage < params.minJointCoverage) {
    reasons.push(`关节可见覆盖率过低 (${(jointCoverage * 100).toFixed(0)}%)。`);
  }

  const amp = estimateMotionAmplitude(pair);
  if (amp < params.minMotionAmplitude) {
    notes.push(`运动幅度极低 (${amp.toFixed(3)})，姿态评分可能虚高。`);
  }

  if (reference.durationMs > 0 && imitation.durationMs > 0) {
    const ratio = Math.max(reference.durationMs, imitation.durationMs) / Math.min(reference.durationMs, imitation.durationMs);
    if (ratio > 4) notes.push("两段动作时长差异超过 4 倍，DTW 对齐可能不可靠。");
  }

  for (const frame of [...refFrames, ...imitFrames]) {
    if (!frame.landmarks) continue;
    let visibleKey = 0;
    for (const idx of [11, 12, 23, 24]) {
      const p = frame.landmarks[idx];
      if (p && p.visibility >= QUALITY_THRESHOLDS.keyJointVisible) visibleKey += 1;
    }
    if (visibleKey < 2) {
      notes.push("部分关键关节（肩/髋）可见性偏低。");
      break;
    }
  }

  return { acceptable: reasons.length === 0, reasons, reviewNotes: notes };
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

export function computeArenaScore(pair: ArenaPreparedPair, mode: ArenaScoreMode): ArenaScore {
  const params = MODE_PARAMS[mode];
  const { refFrames, imitFrames, alignment, reference, imitation } = pair;

  // --- Pose cost (weighted for casual, uniform for research) ---
  const poseCost = params.useJointWeights
    ? computeWeightedPoseCost(refFrames, imitFrames, alignment.path, CASUAL_LANDMARK_WEIGHTS)
    : alignment.normalizedCost;

  const rawSimilarity = Math.exp(-params.poseSensitivity * Math.min(poseCost, params.poseCostCap));
  const poseSimilarity = Math.round(rawSimilarity * 100);

  // --- Timing ---
  const timing = computeTimingMetrics(reference, imitation, alignment);
  const durationSimilarity = 1 - timing.relativeDiff;
  const rhythm = params.softRhythm
    ? Math.pow(Math.max(0, timing.rhythmSimilarity), 0.6)
    : timing.rhythmSimilarity;
  const timingRaw = params.durationWeight * durationSimilarity + (1 - params.durationWeight) * rhythm;
  const timingSimilarity = Math.round(Math.max(0, timingRaw) * 100);

  // --- Joint differences ---
  const jointDiffs = computeJointDifferences(refFrames, imitFrames, alignment.path, reference.mode);

  // --- Key moments ---
  const keyMoments = findKeyMoments(refFrames, imitFrames, alignment.path);

  // --- Coverage ---
  const coverage = estimateJointCoverage(pair);

  // --- Overall ---
  const overallRaw =
    params.overallPoseWeight * rawSimilarity +
    params.overallTimingWeight * timingRaw +
    params.overallCoverageWeight * coverage;
  const overallMatch = Math.round(Math.max(0, Math.min(1, overallRaw)) * 100);

  // --- Quality ---
  const quality = checkArenaQuality(pair, mode);

  // --- Explanation ---
  const explanation = buildExplanation(poseSimilarity, timingSimilarity, overallMatch, timing, quality, alignment, jointDiffs, keyMoments, mode);

  return { poseSimilarity, timingSimilarity, overallMatch, jointDifferences: jointDiffs, keyMoments, quality, explanation };
}

function buildExplanation(
  pose: number, timing: number, overall: number,
  timingMetrics: { relativeDiff: number; rhythmSimilarity: number; note: string },
  quality: ArenaQualityResult,
  alignment: { normalizedCost: number; pathLength: number },
  jointDiffs: JointDifference[],
  keyMoments: KeyMoment[],
  mode: ArenaScoreMode,
): string {
  const modeLabel = mode === "casual" ? "娱乐模式" : "分析模式";
  const lines: string[] = [];
  lines.push(`评分模式：${modeLabel}。`);
  lines.push(`姿态相似度 ${pose}/100（DTW 归一化距离 ${alignment.normalizedCost.toFixed(3)}${mode === "casual" ? "，已对末端关节降低权重" : ""}）。`);
  lines.push(`时间相似度 ${timing}/100（时长比 ${(1 - timingMetrics.relativeDiff).toFixed(2)}，节律 ${timingMetrics.rhythmSimilarity.toFixed(2)}；${timingMetrics.note}）。`);

  if (jointDiffs.length > 0) {
    const top = jointDiffs[0];
    lines.push(`差异最大：${top.labelZh}（均值 ${top.meanDistance.toFixed(3)}，峰值 ${top.maxDistance.toFixed(3)}）。`);
  }
  if (keyMoments.length > 0) {
    const worst = keyMoments[0];
    lines.push(`差异最大时段：${(worst.startMs / 1000).toFixed(1)}s–${(worst.endMs / 1000).toFixed(1)}s。`);
  }
  if (!quality.acceptable) lines.push(`⚠️ 质量门未通过：${quality.reasons.join("；")}`);
  for (const note of quality.reviewNotes) lines.push(`📋 ${note}`);

  lines.push(`综合 ${overall}/100。本评分为趣味指标，未经临床验证。`);
  return lines.join("\n");
}