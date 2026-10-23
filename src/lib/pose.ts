import {
  CAPTURE_MODES,
  CONNECTION_COLORS,
  KEY_JOINT_INDICES,
  POSE_CONNECTIONS,
  QUALITY_THRESHOLDS,
} from "../config/constants";
import type {
  CaptureMode,
  CaptureReadiness,
  FramingState,
  PosePoint,
  PoseSignal,
} from "../types/pose";

interface NormalizedLandmarkLike {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface OverlayOptions {
  showSkeleton: boolean;
  showGrid: boolean;
  captureMode: CaptureMode;
}

export function toPosePoint(landmark: NormalizedLandmarkLike): PosePoint {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility ?? 0,
  };
}

export function toPosePoints(
  landmarks: readonly NormalizedLandmarkLike[] | undefined,
): PosePoint[] | null {
  if (!landmarks || landmarks.length < 33) return null;
  return landmarks.slice(0, 33).map(toPosePoint);
}

export function countVisibleKeyJoints(
  landmarks: readonly PosePoint[] | null,
  threshold = QUALITY_THRESHOLDS.keyJointVisible,
): number {
  if (!landmarks || landmarks.length <= 32) return 0;
  return KEY_JOINT_INDICES.reduce(
    (count, index) =>
      landmarks[index].visibility >= threshold ? count + 1 : count,
    0,
  );
}

export function averageVisibility(landmarks: readonly PosePoint[] | null): number {
  if (!landmarks || landmarks.length === 0) return 0;
  const total = landmarks.reduce((sum, point) => sum + point.visibility, 0);
  return total / landmarks.length;
}

/** Normalized MediaPipe coordinates (0–1) → canvas pixel coordinates. */
export function toPixelCoordinate(
  point: Pick<PosePoint, "x" | "y">,
  width: number,
  height: number,
): { x: number; y: number } {
  return { x: point.x * width, y: point.y * height };
}

/**
 * Heuristic check for whether the original camera stream contains the whole
 * body. It deliberately answers a framing question, not a clinical one.
 */
export function assessFraming(
  landmarks: readonly PosePoint[] | null,
  threshold = QUALITY_THRESHOLDS.landmarkVisible,
): FramingState {
  if (!landmarks || landmarks.length < 33) return "unknown";
  const visible = (index: number) =>
    (landmarks[index]?.visibility ?? 0) >= threshold;

  const upperVisible =
    visible(0) || visible(7) || visible(8) || visible(11) || visible(12);
  const kneeVisible = visible(25) || visible(26);
  const ankleVisible = visible(27) || visible(28);

  if (!upperVisible) return "upper-cut";
  if (!kneeVisible || !ankleVisible) return "lower-cut";
  return "full";
}

/**
 * Mode-aware capture readiness. Upper Body deliberately ignores the lower
 * body; Full Body requires one stable point from every major body region and
 * that point must remain inside the original camera frame.
 */
export function assessCaptureReadiness(
  landmarks: readonly PosePoint[] | null,
  mode: CaptureMode,
  threshold = QUALITY_THRESHOLDS.keyJointVisible,
): CaptureReadiness {
  const definition = CAPTURE_MODES[mode];
  if (!landmarks || landmarks.length < 33) {
    return {
      mode,
      ready: false,
      visibleGroups: 0,
      totalGroups: definition.requiredGroups.length,
      missingLabels: definition.requiredGroups.map((group) => group.label),
    };
  }

  const available = (index: number) => {
    const point = landmarks[index];
    if (!point || point.visibility < threshold) return false;
    return (
      point.x >= 0 &&
      point.x <= 1 &&
      point.y >= 0 &&
      point.y <= 1
    );
  };

  const missingLabels = definition.requiredGroups
    .filter((group) => !group.indices.some(available))
    .map((group) => group.label);

  return {
    mode,
    ready: missingLabels.length === 0,
    visibleGroups: definition.requiredGroups.length - missingLabels.length,
    totalGroups: definition.requiredGroups.length,
    missingLabels,
  };
}

export function classifyPoseSignal(
  landmarks: readonly PosePoint[] | null,
  nowMs: number,
  lastPoseAtMs: number | null,
  visibleKeyJoints = countVisibleKeyJoints(landmarks),
  lostGraceMs = QUALITY_THRESHOLDS.lostPoseGraceMs,
): { signal: PoseSignal; lostForMs: number } {
  if (landmarks) {
    const partial =
      visibleKeyJoints < QUALITY_THRESHOLDS.minVisibleKeyJoints;
    return { signal: partial ? "partial" : "ok", lostForMs: 0 };
  }

  const lostForMs =
    lastPoseAtMs === null ? Number.POSITIVE_INFINITY : Math.max(0, nowMs - lastPoseAtMs);
  return {
    signal: lostForMs >= lostGraceMs ? "lost" : "none",
    lostForMs,
  };
}

/** Draw the transparent skeleton / calibration overlay on the video stage. */
export function renderOverlay(
  canvas: HTMLCanvasElement,
  landmarks: readonly PosePoint[] | null,
  options: OverlayOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (options.showGrid) {
    drawCalibrationGrid(ctx, width, height);
  }
  if (options.showSkeleton && landmarks) {
    drawSkeleton(ctx, landmarks, width, height, options.captureMode);
  }
}

function drawCalibrationGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const unit = width / 640;
  ctx.save();
  ctx.strokeStyle = "rgba(120, 200, 255, 0.16)";
  ctx.fillStyle = "rgba(180, 220, 255, 0.52)";
  ctx.lineWidth = Math.max(1, unit);
  ctx.setLineDash([Math.max(6, 8 * unit), Math.max(8, 12 * unit)]);

  for (let i = 1; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo((width * i) / 3, 0);
    ctx.lineTo((width * i) / 3, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (height * i) / 3);
    ctx.lineTo(width, (height * i) / 3);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(85, 230, 216, 0.55)";
  ctx.lineWidth = Math.max(1.5, 2 * unit);
  const corner = Math.max(18, 26 * unit);
  const inset = Math.max(12, 18 * unit);
  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [width - inset, inset, -1, 1],
    [inset, height - inset, 1, -1],
    [width - inset, height - inset, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + dx * corner, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * corner);
    ctx.stroke();
  }

  ctx.font = `${Math.max(11, 15 * unit)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText("CALIBRATION GRID · SOURCE COORDINATES · NOT MIRRORED", inset + 10, inset + 24 * unit);
  ctx.restore();
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly PosePoint[],
  width: number,
  height: number,
  captureMode: CaptureMode,
): void {
  const unit = Math.max(0.75, width / 720);
  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  const upperBodyOnly = captureMode === "upper-body";

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const connection of POSE_CONNECTIONS) {
    if (
      upperBodyOnly &&
      (connection.group === "leftLeg" || connection.group === "rightLeg")
    ) {
      continue;
    }
    const from = landmarks[connection.from];
    const to = landmarks[connection.to];
    if (!from || !to) continue;
    if (
      from.visibility < threshold ||
      to.visibility < threshold ||
      !isFinitePoint(from, to)
    ) {
      continue;
    }

    const fromPixel = toPixelCoordinate(from, width, height);
    const toPixel = toPixelCoordinate(to, width, height);

    ctx.beginPath();
    ctx.moveTo(fromPixel.x, fromPixel.y);
    ctx.lineTo(toPixel.x, toPixel.y);
    ctx.strokeStyle = CONNECTION_COLORS[connection.group];
    ctx.globalAlpha = Math.min(
      1,
      0.32 + Math.min(from.visibility, to.visibility) * 0.65,
    );
    ctx.lineWidth = (connection.group === "face" ? 2 : 4.6) * unit;
    ctx.shadowColor = CONNECTION_COLORS[connection.group];
    ctx.shadowBlur = 9 * unit;
    ctx.stroke();
  }

  for (let index = 0; index < landmarks.length; index += 1) {
    // MediaPipe indices 25–32 are knees, ankles and feet.
    if (upperBodyOnly && index >= 25) continue;
    const point = landmarks[index];
    if (!point || point.visibility < threshold) continue;
    const pixel = toPixelCoordinate(point, width, height);
    const { x, y } = pixel;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const isKeyJoint = (KEY_JOINT_INDICES as readonly number[]).includes(index);
    const radius = (isKeyJoint ? 5.2 : 3.4) * unit;

    ctx.globalAlpha = Math.min(1, 0.35 + point.visibility * 0.7);
    ctx.beginPath();
    ctx.arc(x, y, radius + 2.5 * unit, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(6, 12, 24, 0.72)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isKeyJoint ? "#eafffb" : "#8ef4e8";
    ctx.shadowColor = "#55e6d8";
    ctx.shadowBlur = 12 * unit;
    ctx.fill();
  }

  ctx.restore();
}

function isFinitePoint(a: PosePoint, b: PosePoint): boolean {
  return (
    Number.isFinite(a.x) &&
    Number.isFinite(a.y) &&
    Number.isFinite(b.x) &&
    Number.isFinite(b.y)
  );
}
