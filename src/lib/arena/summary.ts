import type { ArenaScore } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";

/**
 * Generate a friendly, natural-language summary from real scoring data.
 * Never fabricates praise — it derives every sentence from actual metrics.
 * Duration difference and local rhythm are explained separately so the copy
 * stays consistent with the numbers (e.g. a high timing score never gets a
 * "速度差异明显" line).
 */
export function buildResultSummary(
  score: ArenaScore,
  actionA: GhostAction | null,
  actionB: GhostAction | null,
): string {
  const parts: string[] = [];

  // 1) Overall verdict
  const overall = score.overallMatch;
  if (overall >= 90) parts.push("动作完成度很高，两人表现几乎一致。");
  else if (overall >= 75) parts.push("动作完成得不错，整体比较接近。");
  else if (overall >= 60) parts.push("动作基本完成，但还有明显差距。");
  else if (overall >= 40) parts.push("动作有一定偏差，建议对照参考再试一次。");
  else parts.push("两段动作差异较大，可能没有跟上参考动作。");

  // 2) Duration difference — total time, separately from rhythm
  const durationDiffSec =
    actionA && actionB
      ? Math.abs(actionA.durationMs - actionB.durationMs) / 1000
      : 0;
  if (durationDiffSec <= 0.3) {
    parts.push("两段动作总用时几乎一致。");
  } else if (durationDiffSec <= 1.0) {
    parts.push(`总用时只差 ${durationDiffSec.toFixed(1)} 秒，基本同步。`);
  } else {
    parts.push(`总用时相差约 ${durationDiffSec.toFixed(1)} 秒。`);
  }

  // 3) Timing score (blends duration + rhythm) — always consistent with value
  const timing = score.timingSimilarity;
  if (timing >= 90) parts.push("时间与节律表现很好，动作速率基本吻合。");
  else if (timing >= 75) parts.push("时间与节律整体同步，个别地方速率略有出入。");
  else if (timing >= 60) parts.push("时间与节律存在一定出入，快慢变化不完全吻合。");
  else parts.push("时间与节律差异较大，动作的快慢节奏没有跟上参考。");

  // 4) Biggest joint differences (top 2–3, Chinese names only)
  const top = score.jointDifferences.slice(0, 3);
  if (top.length > 0) {
    const names = top.map((j) => j.labelZh).join("、");
    parts.push(`差异最明显的部位是${names}。`);
  }

  // 5) Where the biggest divergence happened
  if (score.keyMoments.length > 0) {
    const worst = score.keyMoments[0];
    const startSec = (worst.startMs / 1000).toFixed(1);
    const endSec = (worst.endMs / 1000).toFixed(1);
    parts.push(`最大的差异出现在动作的 ${startSec}s–${endSec}s 阶段。`);
  }

  // 6) Quality note
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