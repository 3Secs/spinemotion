/**
 * Monotonic timestamp helpers.
 *
 * MediaPipe VIDEO mode requires strictly increasing timestamps. Browser clocks
 * can move backwards (or two calls can land in the same millisecond), so every
 * inference timestamp goes through nextMonotonicTimestamp().
 */
export function nextMonotonicTimestamp(
  previous: number | null,
  candidate: number,
  minStepMs = 1,
): number {
  if (!Number.isFinite(candidate)) {
    throw new Error("Timestamp candidate must be a finite number");
  }
  if (previous === null || !Number.isFinite(previous)) {
    return candidate;
  }
  return Math.max(candidate, previous + Math.max(0.001, minStepMs));
}

/** Convert a media/video timestamp into a session-relative timestamp. */
export function toSessionTimestamp(epochMs: number, sourceTimeSec: number): number {
  if (!Number.isFinite(epochMs) || !Number.isFinite(sourceTimeSec)) {
    throw new Error("Epoch and source time must be finite numbers");
  }
  return epochMs + Math.max(0, sourceTimeSec) * 1000;
}

/** Safe elapsed seconds, clamped at zero. */
export function elapsedSeconds(startMs: number, nowMs: number): number {
  return Math.max(0, (nowMs - startMs) / 1000);
}

export function formatSeconds(seconds: number, digits = 1): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  return `${seconds.toFixed(digits)}s`;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.0";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toFixed(1)
    .padStart(4, "0")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
