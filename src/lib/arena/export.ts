import type { ArenaScore } from "../../types/arena";
import type { GhostAction } from "../../types/ghost";

export interface ArenaExportData {
  exportedAt: string;
  score: {
    overallMatch: number;
    poseSimilarity: number;
    timingSimilarity: number;
  };
  quality: {
    acceptable: boolean;
    reasons: string[];
    notes: string[];
  };
  actions: {
    a: { durationMs: number; frames: number; validFrames: number; mode: string };
    b: { durationMs: number; frames: number; validFrames: number; mode: string };
  };
  topDifferences: Array<{ joint: string; index: number; mean: number; max: number }>;
  keyMoments: Array<{ startSec: number; endSec: number; mean: number; peak: number }>;
}

export function buildExportData(
  score: ArenaScore,
  actionA: GhostAction | null,
  actionB: GhostAction | null,
): ArenaExportData {
  return {
    exportedAt: new Date().toISOString(),
    score: {
      overallMatch: score.overallMatch,
      poseSimilarity: score.poseSimilarity,
      timingSimilarity: score.timingSimilarity,
    },
    quality: {
      acceptable: score.quality.acceptable,
      reasons: score.quality.reasons,
      notes: score.quality.reviewNotes,
    },
    actions: {
      a: actionA ? {
        durationMs: actionA.durationMs,
        frames: actionA.recording.totalFrames,
        validFrames: actionA.recording.validFrames,
        mode: actionA.mode,
      } : { durationMs: 0, frames: 0, validFrames: 0, mode: "未知" },
      b: actionB ? {
        durationMs: actionB.durationMs,
        frames: actionB.recording.totalFrames,
        validFrames: actionB.recording.validFrames,
        mode: actionB.mode,
      } : { durationMs: 0, frames: 0, validFrames: 0, mode: "未知" },
    },
    topDifferences: score.jointDifferences.slice(0, 10).map((j) => ({
      joint: j.labelZh,
      index: j.landmarkIndex,
      mean: Number(j.meanDistance.toFixed(5)),
      max: Number(j.maxDistance.toFixed(5)),
    })),
    keyMoments: score.keyMoments.map((m) => ({
      startSec: Number((m.startMs / 1000).toFixed(2)),
      endSec: Number((m.endMs / 1000).toFixed(2)),
      mean: Number(m.meanDistance.toFixed(5)),
      peak: Number(m.peakDistance.toFixed(5)),
    })),
  };
}

export function downloadArenaResult(data: ArenaExportData, filename = "arena-result.json"): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadArenaResultCSV(data: ArenaExportData, filename = "arena-result.csv"): void {
  const lines: string[] = [];
  lines.push(["部位", "平均距离", "最大距离"].join(","));
  for (const d of data.topDifferences) {
    lines.push([d.joint, d.mean.toFixed(5), d.max.toFixed(5)].join(","));
  }
  lines.push("");
  lines.push(["指标", "数值"].join(","));
  lines.push(["综合匹配", data.score.overallMatch].join(","));
  lines.push(["姿态相似", data.score.poseSimilarity].join(","));
  lines.push(["时间相似", data.score.timingSimilarity].join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}