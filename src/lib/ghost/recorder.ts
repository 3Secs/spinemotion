import {
  GHOST_COORDINATE_SPACE,
  GHOST_SCHEMA,
  GHOST_SCHEMA_VERSION,
  type GhostAction,
  type GhostFrame,
} from "../../types/ghost";
import type {
  ActiveDelegate,
  CaptureMode,
  PoseFrameSample,
} from "../../types/pose";
import {
  assessCaptureReadiness,
  countVisibleKeyJoints,
} from "../pose";

export interface MotionRecorderOptions {
  requestedDurationMs: number;
  mode: CaptureMode;
  mirrored: boolean;
  targetFps: number;
  activeDelegate?: ActiveDelegate | null;
  cameraLabel?: string | null;
}

export interface RecorderSnapshot {
  active: boolean;
  frameCount: number;
  validFrameCount: number;
  durationMs: number;
}

export class MotionRecorder {
  private frames: GhostFrame[] = [];
  private active = false;
  private baseTimestampMs: number | null = null;
  private lastTimestampMs = -1;
  private firstVideo = { width: 0, height: 0 };
  private startedCapture = false;

  constructor(private readonly options: MotionRecorderOptions) {}

  start(): void {
    this.frames = [];
    this.active = true;
    this.baseTimestampMs = null;
    this.lastTimestampMs = -1;
    this.firstVideo = { width: 0, height: 0 };
    this.startedCapture = false;
  }

  isActive(): boolean {
    return this.active;
  }

  addFrame(sample: PoseFrameSample): { accepted: boolean; reachedDuration: boolean } {
    if (!this.active) return { accepted: false, reachedDuration: false };
    if (sample.landmarks && sample.landmarks.length !== 33) {
      return { accepted: false, reachedDuration: false };
    }

    if (this.baseTimestampMs === null) {
      this.baseTimestampMs = sample.timestampMs;
    }
    const relativeMs = Math.max(
      0,
      Math.round(sample.timestampMs - this.baseTimestampMs),
    );
    if (relativeMs <= this.lastTimestampMs) {
      return { accepted: false, reachedDuration: false };
    }
    if (relativeMs > this.options.requestedDurationMs + 100) {
      return { accepted: false, reachedDuration: true };
    }

    if (!this.startedCapture) {
      this.firstVideo = {
        width: sample.videoSize.width,
        height: sample.videoSize.height,
      };
      this.startedCapture = true;
    }

    const readiness = assessCaptureReadiness(
      sample.landmarks,
      this.options.mode,
    );
    const valid =
      sample.landmarks !== null &&
      readiness.visibleGroups >= Math.ceil(readiness.totalGroups / 2);
    const frame: GhostFrame = {
      timestampMs: relativeMs,
      landmarks: sample.landmarks,
      quality: {
        valid,
        hasPose: sample.landmarks !== null,
        visibleKeyJoints: countVisibleKeyJoints(sample.landmarks),
        readinessGroups: readiness.visibleGroups,
        totalGroups: readiness.totalGroups,
        missingGroups: readiness.missingLabels,
      },
    };

    this.frames.push(frame);
    this.lastTimestampMs = relativeMs;
    const reachedDuration = relativeMs >= this.options.requestedDurationMs;
    if (reachedDuration) {
      this.active = false;
    }
    return { accepted: true, reachedDuration };
  }

  snapshot(): RecorderSnapshot {
    return {
      active: this.active,
      frameCount: this.frames.length,
      validFrameCount: this.frames.filter((frame) => frame.quality.valid).length,
      durationMs: Math.max(0, this.lastTimestampMs),
    };
  }

  stop(name?: string): GhostAction | null {
    this.active = false;
    if (this.frames.length === 0) return null;

    const durationMs = this.lastTimestampMs;
    const validFrames = this.frames.filter((frame) => frame.quality.valid).length;
    const totalFrames = this.frames.length;
    const aspectRatio =
      this.firstVideo.width > 0 && this.firstVideo.height > 0
        ? this.firstVideo.width / this.firstVideo.height
        : 1;
    const createdAt = new Date().toISOString();

    return {
      schema: GHOST_SCHEMA,
      version: GHOST_SCHEMA_VERSION,
      coordinateSpace: GHOST_COORDINATE_SPACE,
      id: createActionId(),
      name: name?.trim() || createDefaultName(this.options.mode),
      createdAt,
      mode: this.options.mode,
      mirrored: this.options.mirrored,
      durationMs,
      capture: {
        videoWidth: this.firstVideo.width,
        videoHeight: this.firstVideo.height,
        aspectRatio,
        targetFps: this.options.targetFps,
        activeDelegate: this.options.activeDelegate ?? null,
        cameraLabel: this.options.cameraLabel ?? null,
      },
      recording: {
        requestedDurationMs: this.options.requestedDurationMs,
        totalFrames,
        validFrames,
        validFrameRatio: totalFrames > 0 ? validFrames / totalFrames : 0,
        measuredFps: durationMs > 0 ? ((totalFrames - 1) / durationMs) * 1000 : 0,
      },
      frames: this.frames,
    };
  }
}

function createActionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultName(mode: CaptureMode): string {
  const label = mode === "upper-body" ? "Upper Body" : "Full Body";
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${label} · ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
