import {
  GHOST_COORDINATE_SPACE,
  GHOST_SCHEMA,
  GHOST_SCHEMA_VERSION,
  type GhostAction,
  type GhostFrame,
  type GhostFrameQuality,
} from "../../types/ghost";
import type { PosePoint } from "../../types/pose";

export type GhostValidationResult =
  | { ok: true; action: GhostAction }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUnitNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function validatePoint(value: unknown, frameIndex: number, pointIndex: number): string | null {
  if (!isRecord(value)) {
    return `第 ${frameIndex + 1} 帧的第 ${pointIndex + 1} 个关键点不是对象。`;
  }
  if (
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.z)
  ) {
    return `第 ${frameIndex + 1} 帧的第 ${pointIndex + 1} 个关键点坐标无效。`;
  }
  if (!isUnitNumber(value.visibility)) {
    return `第 ${frameIndex + 1} 帧的第 ${pointIndex + 1} 个关键点 visibility 超出 [0,1]。`;
  }
  if (value.presence !== undefined && !isUnitNumber(value.presence)) {
    return `第 ${frameIndex + 1} 帧的第 ${pointIndex + 1} 个关键点 presence 超出 [0,1]。`;
  }
  return null;
}

function validateFrame(value: unknown, frameIndex: number): string | null {
  if (!isRecord(value)) return `第 ${frameIndex + 1} 帧不是对象。`;
  if (!isFiniteNumber(value.timestampMs) || value.timestampMs < 0) {
    return `第 ${frameIndex + 1} 帧时间戳无效。`;
  }
  if (value.landmarks !== null && !Array.isArray(value.landmarks)) {
    return `第 ${frameIndex + 1} 帧关键点必须为 33 点数组或 null。`;
  }
  if (Array.isArray(value.landmarks)) {
    if (value.landmarks.length !== 33) {
      return `第 ${frameIndex + 1} 帧关键点数量不是 33。`;
    }
    for (let pointIndex = 0; pointIndex < value.landmarks.length; pointIndex += 1) {
      const pointError = validatePoint(
        value.landmarks[pointIndex],
        frameIndex,
        pointIndex,
      );
      if (pointError) return pointError;
    }
  }
  if (!isRecord(value.quality)) {
    return `第 ${frameIndex + 1} 帧缺少质量信息。`;
  }
  const quality = value.quality;
  if (
    typeof quality.valid !== "boolean" ||
    typeof quality.hasPose !== "boolean" ||
    !Number.isInteger(quality.visibleKeyJoints) ||
    !Number.isInteger(quality.readinessGroups) ||
    !Number.isInteger(quality.totalGroups) ||
    !Array.isArray(quality.missingGroups) ||
    quality.missingGroups.some((item) => typeof item !== "string")
  ) {
    return `第 ${frameIndex + 1} 帧质量信息格式错误。`;
  }
  if (quality.hasPose !== (value.landmarks !== null)) {
    return `第 ${frameIndex + 1} 帧质量信息与关键点状态不一致。`;
  }
  return null;
}

/**
 * Structural + version validation for imported files. Unknown fields are
 * preserved only if they live on a valid object, but never relied upon.
 */
export function validateGhostAction(value: unknown): GhostValidationResult {
  if (!isRecord(value)) return { ok: false, error: "JSON 根节点必须是对象。" };
  if (value.schema !== GHOST_SCHEMA) {
    return { ok: false, error: `不是 SpineMotion 动作文件（schema 应为 ${GHOST_SCHEMA}）。` };
  }
  if (value.version !== GHOST_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `不支持的动作文件版本：${String(value.version)}。当前支持版本 ${GHOST_SCHEMA_VERSION}。`,
    };
  }
  if (value.coordinateSpace !== GHOST_COORDINATE_SPACE) {
    return {
      ok: false,
      error: `坐标空间无效：${String(value.coordinateSpace)}。应为 ${GHOST_COORDINATE_SPACE}。`,
    };
  }
  if (typeof value.id !== "string" || value.id.length === 0 || value.id.length > 128) {
    return { ok: false, error: "动作 id 缺失或长度无效。" };
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0 || value.name.length > 200) {
    return { ok: false, error: "动作名称缺失或过长。" };
  }
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) {
    return { ok: false, error: "动作创建时间无效。" };
  }
  if (value.mode !== "upper-body" && value.mode !== "full-body") {
    return { ok: false, error: "动作模式必须为 upper-body 或 full-body。" };
  }
  if (typeof value.mirrored !== "boolean") {
    return { ok: false, error: "mirrored 必须为布尔值。" };
  }
  if (!isFiniteNumber(value.durationMs) || value.durationMs < 0 || value.durationMs > 120_000) {
    return { ok: false, error: "动作时长无效。" };
  }
  if (!isRecord(value.capture)) {
    return { ok: false, error: "缺少 capture 采集信息。" };
  }
  const capture = value.capture;
  if (
    !isFiniteNumber(capture.videoWidth) ||
    !isFiniteNumber(capture.videoHeight) ||
    capture.videoWidth <= 0 ||
    capture.videoHeight <= 0 ||
    capture.videoWidth > 8192 ||
    capture.videoHeight > 8192
  ) {
    return { ok: false, error: "摄像头分辨率无效。" };
  }
  if (!isFiniteNumber(capture.aspectRatio) || capture.aspectRatio <= 0) {
    return { ok: false, error: "摄像头宽高比无效。" };
  }
  if (!isFiniteNumber(capture.targetFps) || capture.targetFps <= 0 || capture.targetFps > 60) {
    return { ok: false, error: "目标推理帧率无效。" };
  }
  if (
    (capture.activeDelegate !== null && capture.activeDelegate !== "GPU" && capture.activeDelegate !== "CPU") ||
    (capture.cameraLabel !== null && typeof capture.cameraLabel !== "string")
  ) {
    return { ok: false, error: "推理设备或摄像头名称字段无效。" };
  }
  if (!isRecord(value.recording)) {
    return { ok: false, error: "缺少 recording 录制信息。" };
  }
  const recording = value.recording;
  if (
    !isFiniteNumber(recording.requestedDurationMs) ||
    !Number.isInteger(recording.totalFrames) ||
    !Number.isInteger(recording.validFrames) ||
    !isFiniteNumber(recording.validFrameRatio) ||
    !isFiniteNumber(recording.measuredFps)
  ) {
    return { ok: false, error: "录制统计信息格式错误。" };
  }
  if (!Array.isArray(value.frames) || value.frames.length === 0) {
    return { ok: false, error: "动作文件不包含关键帧。" };
  }
  if (value.frames.length > 20_000) {
    return { ok: false, error: "动作帧数超过 20000，无法加载。" };
  }
  if (recording.totalFrames !== value.frames.length) {
    return { ok: false, error: "录制统计的总帧数与实际帧数不一致。" };
  }

  let previousTimestamp = -1;
  for (let frameIndex = 0; frameIndex < value.frames.length; frameIndex += 1) {
    const frameError = validateFrame(value.frames[frameIndex], frameIndex);
    if (frameError) return { ok: false, error: frameError };
    const frame = value.frames[frameIndex] as GhostFrame;
    if (frame.timestampMs <= previousTimestamp) {
      return { ok: false, error: `第 ${frameIndex + 1} 帧时间戳未严格递增。` };
    }
    previousTimestamp = frame.timestampMs;
  }

  const lastTimestamp = previousTimestamp;
  if (Math.abs(lastTimestamp - value.durationMs) > 2) {
    return { ok: false, error: "durationMs 与最后一帧时间戳不一致。" };
  }
  if (
    Math.abs(
      recording.validFrameRatio -
        (recording.validFrames as number) / value.frames.length,
    ) > 0.002
  ) {
    return { ok: false, error: "有效帧比例与有效帧数量不一致。" };
  }
  if (Math.abs(capture.aspectRatio - capture.videoWidth / capture.videoHeight) > 0.02) {
    return { ok: false, error: "capture.aspectRatio 与摄像头分辨率不一致。" };
  }

  return { ok: true, action: value as unknown as GhostAction };
}

export function parseGhostActionJson(text: string): GhostValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
  return validateGhostAction(parsed);
}

export function serializeGhostAction(action: GhostAction): string {
  return JSON.stringify(action, null, 2);
}

export function createGhostFileName(action: GhostAction): string {
  const safeName =
    action.name
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "motion-ghost";
  return `${safeName}-${action.id.slice(0, 8)}.json`;
}

export function qualityFromPoints(
  landmarks: PosePoint[] | null,
  quality: Omit<GhostFrameQuality, "hasPose">,
): GhostFrameQuality {
  return { ...quality, hasPose: landmarks !== null };
}
