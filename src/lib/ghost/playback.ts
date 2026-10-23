import { GHOST_CONFIG } from "../../config/constants";
import type {
  GhostAction,
  GhostFrame,
  GhostSample,
  GhostSampleStatus,
} from "../../types/ghost";
import type { PosePoint } from "../../types/pose";

/** Index of the last frame whose timestamp is <= timeMs. */
export function findFrameIndexAt(
  frames: readonly GhostFrame[],
  timeMs: number,
): number {
  if (frames.length === 0) return -1;
  let low = 0;
  let high = frames.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (frames[middle].timestampMs <= timeMs) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return Math.max(0, high);
}

export function interpolateLandmarks(
  from: readonly PosePoint[],
  to: readonly PosePoint[],
  alpha: number,
): PosePoint[] {
  const t = Math.min(1, Math.max(0, alpha));
  return from.map((point, index) => {
    const other = to[index];
    const result: PosePoint = {
      x: point.x + (other.x - point.x) * t,
      y: point.y + (other.y - point.y) * t,
      z: point.z + (other.z - point.z) * t,
      visibility:
        point.visibility + (other.visibility - point.visibility) * t,
    };
    if (
      typeof point.presence === "number" &&
      typeof other.presence === "number"
    ) {
      result.presence =
        point.presence + (other.presence - point.presence) * t;
    }
    return result;
  });
}

function nearestValidFrame(
  frames: readonly GhostFrame[],
  timeMs: number,
  maxDistanceMs: number,
): GhostFrame | null {
  const index = findFrameIndexAt(frames, timeMs);
  let best: GhostFrame | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const frame = frames[cursor];
    const distance = Math.abs(timeMs - frame.timestampMs);
    if (distance > maxDistanceMs) break;
    if (frame.landmarks) {
      if (distance < bestDistance) {
        best = frame;
        bestDistance = distance;
      }
      break;
    }
  }

  for (let cursor = index + 1; cursor < frames.length; cursor += 1) {
    const frame = frames[cursor];
    const distance = Math.abs(frame.timestampMs - timeMs);
    if (distance > maxDistanceMs) break;
    if (frame.landmarks) {
      if (distance < bestDistance) best = frame;
      break;
    }
  }

  return best;
}

/**
 * Sample a recording using its real timestamps.
 *
 * Interpolation is allowed only between two valid neighbouring frames whose
 * timestamps are close. Gaps are held briefly and then reported as a gap, so
 * a missing pose is never stretched across a long interval.
 */
export function sampleGhostAction(
  action: GhostAction,
  requestedTimeMs: number,
): GhostSample {
  const frames = action.frames;
  if (frames.length === 0) {
    return { timeMs: 0, landmarks: null, status: "empty" };
  }

  const duration = action.durationMs;
  const timeMs = Math.min(duration, Math.max(0, requestedTimeMs));
  const first = frames[0];
  const last = frames[frames.length - 1];

  if (timeMs <= first.timestampMs) {
    return {
      timeMs: first.timestampMs,
      landmarks: first.landmarks,
      status: first.landmarks ? "first" : "gap",
    };
  }
  if (timeMs >= last.timestampMs) {
    return {
      timeMs: last.timestampMs,
      landmarks: last.landmarks,
      status: last.landmarks ? "last" : "gap",
    };
  }

  const index = findFrameIndexAt(frames, timeMs);
  const left = frames[index];
  const right = frames[index + 1];

  if (timeMs === left.timestampMs) {
    return {
      timeMs,
      landmarks: left.landmarks,
      status: left.landmarks ? "held" : "gap",
    };
  }

  const gap = right.timestampMs - left.timestampMs;
  if (
    left.landmarks &&
    right.landmarks &&
    gap <= GHOST_CONFIG.maxInterpolationGapMs
  ) {
    const alpha = (timeMs - left.timestampMs) / gap;
    return {
      timeMs,
      landmarks: interpolateLandmarks(left.landmarks, right.landmarks, alpha),
      status: "interpolated",
    };
  }

  const held = nearestValidFrame(frames, timeMs, GHOST_CONFIG.maxHoldMs);
  return {
    timeMs,
    landmarks: held?.landmarks ?? null,
    status: held ? "held" : "gap",
  };
}

export function describeSampleStatus(status: GhostSampleStatus): string {
  switch (status) {
    case "interpolated":
      return "时间插值";
    case "held":
      return "短暂保持";
    case "gap":
      return "关键帧缺失";
    case "first":
      return "起始帧";
    case "last":
      return "结束帧";
    default:
      return "无动作";
  }
}
