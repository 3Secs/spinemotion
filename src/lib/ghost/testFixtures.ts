import {
  GHOST_COORDINATE_SPACE,
  GHOST_SCHEMA,
  GHOST_SCHEMA_VERSION,
  type GhostAction,
  type GhostFrame,
} from "../../types/ghost";
import type {
  CaptureMode,
  PoseFrameSample,
  PosePoint,
} from "../../types/pose";

export function makeLandmarks(): PosePoint[] {
  const landmarks: PosePoint[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  landmarks[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  landmarks[7] = { x: 0.47, y: 0.22, z: 0, visibility: 0.9 };
  landmarks[8] = { x: 0.53, y: 0.22, z: 0, visibility: 0.9 };
  landmarks[11] = { x: 0.4, y: 0.35, z: 0, visibility: 0.95, presence: 0.9 };
  landmarks[12] = { x: 0.6, y: 0.35, z: 0, visibility: 0.95, presence: 0.9 };
  landmarks[13] = { x: 0.32, y: 0.48, z: 0, visibility: 0.9 };
  landmarks[14] = { x: 0.68, y: 0.48, z: 0, visibility: 0.9 };
  landmarks[15] = { x: 0.25, y: 0.58, z: 0, visibility: 0.9 };
  landmarks[16] = { x: 0.75, y: 0.58, z: 0, visibility: 0.9 };
  landmarks[23] = { x: 0.43, y: 0.62, z: 0, visibility: 0.95 };
  landmarks[24] = { x: 0.57, y: 0.62, z: 0, visibility: 0.95 };
  landmarks[25] = { x: 0.44, y: 0.76, z: 0, visibility: 0.9 };
  landmarks[26] = { x: 0.56, y: 0.76, z: 0, visibility: 0.9 };
  landmarks[27] = { x: 0.43, y: 0.9, z: 0, visibility: 0.9 };
  landmarks[28] = { x: 0.57, y: 0.9, z: 0, visibility: 0.9 };
  landmarks[31] = { x: 0.41, y: 0.94, z: 0, visibility: 0.9 };
  landmarks[32] = { x: 0.59, y: 0.94, z: 0, visibility: 0.9 };
  return landmarks;
}

export function makeFrame(
  timestampMs: number,
  landmarks: PosePoint[] | null = makeLandmarks(),
): GhostFrame {
  return {
    timestampMs,
    landmarks,
    quality: {
      valid: landmarks !== null,
      hasPose: landmarks !== null,
      visibleKeyJoints: landmarks ? 8 : 0,
      readinessGroups: landmarks ? 5 : 0,
      totalGroups: 5,
      missingGroups: landmarks ? [] : ["头部", "肩部", "髋部", "膝部", "踝/足部"],
    },
  };
}

export function makeAction(
  options: {
    mode?: CaptureMode;
    frames?: GhostFrame[];
    mirrored?: boolean;
  } = {},
): GhostAction {
  const frames = options.frames ?? [0, 100, 200].map((time) => makeFrame(time));
  const durationMs = frames[frames.length - 1]?.timestampMs ?? 0;
  const validFrames = frames.filter((frame) => frame.quality.valid).length;
  return {
    schema: GHOST_SCHEMA,
    version: GHOST_SCHEMA_VERSION,
    coordinateSpace: GHOST_COORDINATE_SPACE,
    id: "test-action",
    name: "Test Action",
    createdAt: "2026-10-23T07:00:00.000Z",
    mode: options.mode ?? "upper-body",
    mirrored: options.mirrored ?? false,
    durationMs,
    capture: {
      videoWidth: 1280,
      videoHeight: 720,
      aspectRatio: 1280 / 720,
      targetFps: 12,
      activeDelegate: "GPU",
      cameraLabel: "Test Camera",
    },
    recording: {
      requestedDurationMs: 8000,
      totalFrames: frames.length,
      validFrames,
      validFrameRatio: validFrames / frames.length,
      measuredFps: durationMs > 0 ? ((frames.length - 1) / durationMs) * 1000 : 0,
    },
    frames,
  };
}

export function makeSample(
  timestampMs: number,
  options: {
    mode?: CaptureMode;
    landmarks?: PosePoint[] | null;
    width?: number;
    height?: number;
  } = {},
): PoseFrameSample {
  return {
    timestampMs,
    sourceTimeSec: timestampMs / 1000,
    landmarks: options.landmarks === undefined ? makeLandmarks() : options.landmarks,
    captureMode: options.mode ?? "upper-body",
    mirrored: false,
    videoSize: {
      width: options.width ?? 1280,
      height: options.height ?? 720,
    },
    inferenceMs: 14,
  };
}
