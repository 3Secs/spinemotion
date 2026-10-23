export type DelegateMode = "auto" | "gpu" | "cpu";
export type ActiveDelegate = "GPU" | "CPU";
export type CapturePhase = "idle" | "starting" | "running" | "paused" | "error";
export type ModelStatus = "idle" | "loading" | "ready" | "error";
export type PoseSignal = "none" | "ok" | "partial" | "lost";
export type FramingState = "unknown" | "full" | "upper-cut" | "lower-cut";
export type CaptureMode = "upper-body" | "full-body";


export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface CaptureReadiness {
  mode: CaptureMode;
  ready: boolean;
  visibleGroups: number;
  totalGroups: number;
  missingLabels: string[];
}

export interface PosePoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface VideoSize {
  width: number;
  height: number;
}

export interface CaptureMetrics {
  fps: number;
  inferenceMs: number;
  frames: number;
  sourceTimeSec: number;
}

export interface LivePoseState {
  hasPose: boolean;
  signal: PoseSignal;
  visibleKeyJoints: number;
  visibilityAverage: number;
  landmarks: PosePoint[] | null;
  lostForMs: number;
  framing: FramingState;
}

export interface DelegateInfo {
  active: ActiveDelegate | null;
  fallbackNote: string | null;
}

export interface CaptureError {
  code: string;
  title: string;
  detail: string;
  hint: string;
}
