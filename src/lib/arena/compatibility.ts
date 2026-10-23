import { QUALITY_THRESHOLDS } from "../../config/constants";
import type { ArenaCompatibilityCheck } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";

/**
 * Check whether two GhostAction recordings are compatible for Arena comparison.
 *
 * Requirements:
 * - Same capture mode (upper-body / full-body).
 * - Each action has at least one valid frame.
 * - Each action has enough visible key joints on a typical frame.
 * - Warn when mirror settings differ.
 * - Warn when video aspect ratios differ significantly.
 */
export function checkArenaCompatibility(
  a: GhostAction,
  b: GhostAction,
): ArenaCompatibilityCheck {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // --- Mode ---
  if (a.mode !== b.mode) {
    reasons.push(
      `采集模式不一致：参考为「${a.mode}」，复刻为「${b.mode}」。`,
    );
  }

  // --- Valid frames ---
  const validA = a.recording.validFrames;
  const validB = b.recording.validFrames;
  if (validA === 0) {
    reasons.push("参考动作没有有效帧。");
  }
  if (validB === 0) {
    reasons.push("复刻动作没有有效帧。");
  }

  if (validA > 0 && validB > 0) {
    // Check typical joint visibility on the median-valid frame
    const aFrames = a.frames.filter((f) => f.quality.valid);
    const bFrames = b.frames.filter((f) => f.quality.valid);
    const aMedian = aFrames[Math.floor(aFrames.length / 2)];
    const bMedian = bFrames[Math.floor(bFrames.length / 2)];

    if (aMedian && aMedian.quality.visibleKeyJoints < QUALITY_THRESHOLDS.minVisibleKeyJoints) {
      reasons.push("参考动作的关键关节点可见数不足，无法进行公平比较。");
    }
    if (bMedian && bMedian.quality.visibleKeyJoints < QUALITY_THRESHOLDS.minVisibleKeyJoints) {
      reasons.push("复刻动作的关键关节点可见数不足，无法进行公平比较。");
    }
  }

  // --- Mirror difference (warning only) ---
  if (a.mirrored !== b.mirrored) {
    warnings.push(
      `镜像方向不一致：参考${a.mirrored ? "已镜像" : "未镜像"}，复刻${b.mirrored ? "已镜像" : "未镜像"}。将自动对齐方向。`,
    );
  }

  // --- Aspect ratio difference ---
  const aAspect = a.capture.aspectRatio;
  const bAspect = b.capture.aspectRatio;
  if (aAspect > 0 && bAspect > 0) {
    const ratio = Math.max(aAspect, bAspect) / Math.min(aAspect, bAspect);
    if (ratio > 1.25) {
      warnings.push(
        `摄像头宽高比差异较大（${aAspect.toFixed(2)} vs ${bAspect.toFixed(2)}），归一化后仍可能影响关节距离计算。`,
      );
    }
  }

  // --- Duration warning ---
  const ratioDuration = a.durationMs > 0 && b.durationMs > 0
    ? Math.max(a.durationMs, b.durationMs) / Math.min(a.durationMs, b.durationMs)
    : Infinity;
  if (ratioDuration > 3) {
    warnings.push(
      `两段动作时长差异较大（${(a.durationMs / 1000).toFixed(1)}s vs ${(b.durationMs / 1000).toFixed(1)}s），DTW 可对齐但结果可能不稳定。`,
    );
  }

  return {
    compatible: reasons.length === 0,
    reasons,
    warnings,
  };
}