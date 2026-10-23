import type { ArenaScore } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";

/**
 * Generate a friendly, natural-language summary from real scoring data.
 * Never fabricates praise — it derives every sentence from actual metrics.
 */
export function buildResultSummary(
  score: ArenaScore,
  actionA: GhostAction | null,
  actionB: GhostAction | null,
): string {
  const parts: string[] = [];

  // Overall verdict
  const overall = score.overallMatch;
  if (overall >= 90) parts.push("动作完成度很高，两人表现几乎一致。");
  else if (overall >= 75) parts.push("动作完成得不错，整体比较接近。");
  else if (overall >= 60) parts.push("动作基本完成，但还有明显差距。");
  else if (overall >= 40) parts.push("动作有一定偏差，建议对照参考再试一次。");
  else parts.push("两段动作差异较大，可能没有跟上参考动作。");

  // Timing / rhythm
  const timing = score.timingSimilarity;
  if (timing >= 85) parts.push("节奏和速度掌握得很好。");
  else if (timing >= 70) parts.push("节奏大体一致，速度上略有出入。");
  else parts.push("节奏和速度与参考动作有较明显差异。");

  // Duration comparison
  if (actionA && actionB) {
    const diffSec = Math.abs(actionA.durationMs - actionB.durationMs) / 1000;
    if (diffSec <= 0.5) parts.push("用时基本一致。");
    else parts.push(`用时相差约 ${diffSec.toFixed(1)} 秒。`);
  }

  // Biggest joint differences (top 2–3, using Chinese labels)
  const top = score.jointDifferences.slice(0, 3);
  if (top.length > 0) {
    const names = top.map((j) => j.labelZh).join("、");
    parts.push(`差异最明显的部位是${names}。`);
  }

  // Where the biggest divergence happened
  if (score.keyMoments.length > 0) {
    const worst = score.keyMoments[0];
    const startSec = (worst.startMs / 1000).toFixed(1);
    const endSec = (worst.endMs / 1000).toFixed(1);
    parts.push(`最大的差异出现在动作的 ${startSec}s–${endSec}s 阶段。`);
  }

  // Quality note
  if (!score.quality.acceptable) {
    parts.push("不过本次录制的关键点质量不足以得出可靠结论，建议重新录制。");
  }

  return parts.join("");
}

/** Friendly label for a sub-score (used in the result UI). */
export function describeSubScore(value: number, kind: "pose" | "timing"): string {
  if (kind === "pose") {
    if (value >= 90) return "姿态几乎一致";
    if (value >= 75) return "姿态比较接近";
    if (value >= 60) return "姿态有些偏差";
    return "姿态差异明显";
  }
  if (value >= 90) return "节奏非常同步";
  if (value >= 75) return "节奏基本同步";
  if (value >= 60) return "节奏略有出入";
  return "节奏差异较大";
}