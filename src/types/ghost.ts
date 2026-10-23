import type {
  ActiveDelegate,
  CaptureMode,
  PosePoint,
} from "./pose";

export const GHOST_SCHEMA = "spinemotion.motion" as const;
export const GHOST_SCHEMA_VERSION = 1 as const;
export const GHOST_COORDINATE_SPACE = "mediapipe_normalized" as const;

export interface GhostFrameQuality {
  valid: boolean;
  hasPose: boolean;
  visibleKeyJoints: number;
  readinessGroups: number;
  totalGroups: number;
  missingGroups: string[];
}

export interface GhostFrame {
  /** Milliseconds relative to the first recorded frame. */
  timestampMs: number;
  /**
   * MediaPipe normalized coordinates (x,y in [0,1] relative to the original
   * camera frame). null means the model returned no pose for this inference;
   * points are never fabricated for missing frames.
   */
  landmarks: PosePoint[] | null;
  quality: GhostFrameQuality;
}

export interface GhostCaptureInfo {
  videoWidth: number;
  videoHeight: number;
  aspectRatio: number;
  targetFps: number;
  activeDelegate: ActiveDelegate | null;
  cameraLabel: string | null;
}

export interface GhostRecordingInfo {
  requestedDurationMs: number;
  totalFrames: number;
  validFrames: number;
  validFrameRatio: number;
  measuredFps: number;
}

export interface GhostAction {
  schema: typeof GHOST_SCHEMA;
  version: typeof GHOST_SCHEMA_VERSION;
  coordinateSpace: typeof GHOST_COORDINATE_SPACE;
  id: string;
  name: string;
  createdAt: string;
  mode: CaptureMode;
  /** Whether the recorded display was mirrored. Phase 1/2 display is unmirrored. */
  mirrored: boolean;
  durationMs: number;
  capture: GhostCaptureInfo;
  recording: GhostRecordingInfo;
  frames: GhostFrame[];
}

export interface GhostCalibration {
  /** Manual offsets in current normalized display coordinates. */
  offsetX: number;
  offsetY: number;
  /** Manual scale multiplier around the aligned body anchor. */
  scale: number;
}

export const DEFAULT_GHOST_CALIBRATION: GhostCalibration = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

export interface GhostBodyCalibration {
  /** Body anchor in aspect-corrected source coordinates: x * aspect, y. */
  anchorX: number;
  anchorY: number;
  /** Body scale in aspect-corrected units (torso length or shoulder width). */
  scale: number;
  aspect: number;
}

export type GhostSampleStatus =
  | "empty"
  | "first"
  | "last"
  | "interpolated"
  | "held"
  | "gap";

export interface GhostSample {
  timeMs: number;
  landmarks: PosePoint[] | null;
  status: GhostSampleStatus;
}
