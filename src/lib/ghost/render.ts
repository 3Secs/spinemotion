import {
  KEY_JOINT_INDICES,
  LANDMARK_LABELS_ZH,
  POSE_CONNECTIONS,
  QUALITY_THRESHOLDS,
} from "../../config/constants";
import type { CaptureMode, PosePoint } from "../../types/pose";

export interface GhostRenderOptions {
  mode: CaptureMode;
  opacity: number;
  showLabels?: boolean;
}

/** Draw a semi-transparent cyan reference skeleton on a transparent canvas. */
export function renderGhostSkeleton(
  canvas: HTMLCanvasElement,
  landmarks: readonly PosePoint[] | null,
  options: GhostRenderOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const opacity = Math.max(0, Math.min(1, options.opacity));
  if (opacity <= 0) return;

  const upperBodyOnly = options.mode === "upper-body";
  const unit = Math.max(0.75, width / 720);
  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  const ghostColor = "rgba(84, 220, 255, 1)";

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
      !Number.isFinite(from.x) ||
      !Number.isFinite(from.y) ||
      !Number.isFinite(to.x) ||
      !Number.isFinite(to.y)
    ) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(from.x * width, from.y * height);
    ctx.lineTo(to.x * width, to.y * height);
    ctx.strokeStyle = ghostColor;
    ctx.globalAlpha =
      opacity * (connection.group === "face" ? 0.38 : 0.72);
    ctx.lineWidth = (connection.group === "face" ? 1.5 : 3.6) * unit;
    ctx.shadowColor = "#47d7ff";
    ctx.shadowBlur = 10 * unit;
    ctx.stroke();
  }

  for (let index = 0; index < landmarks.length; index += 1) {
    if (upperBodyOnly && index >= 25) continue;
    const point = landmarks[index];
    if (!point || point.visibility < threshold) continue;
    const x = point.x * width;
    const y = point.y * height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const keyJoint =
      index === 11 || index === 12 || index === 23 || index === 24;
    const radius = (keyJoint ? 4.4 : 2.8) * unit;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.globalAlpha = opacity * 0.9;
    ctx.fillStyle = "rgba(7, 24, 35, 0.7)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = ghostColor;
    ctx.lineWidth = Math.max(1.2, 1.8 * unit);
    ctx.shadowColor = "#47d7ff";
    ctx.shadowBlur = 8 * unit;
    ctx.stroke();
  }

  if (options.showLabels) {
    drawGhostLabels(ctx, landmarks, width, height, upperBodyOnly, opacity);
  }

  ctx.restore();
}

function drawGhostLabels(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly PosePoint[],
  width: number,
  height: number,
  upperBodyOnly: boolean,
  opacity: number,
): void {
  const unit = Math.max(0.75, width / 720);
  const threshold = QUALITY_THRESHOLDS.landmarkVisible;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.font = `${Math.max(9, 11 * unit)}px ui-sans-serif, system-ui, "PingFang SC", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (const index of KEY_JOINT_INDICES as readonly number[]) {
    if (upperBodyOnly && index >= 25) continue;
    const p = landmarks[index];
    if (!p || p.visibility < threshold) continue;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const x = p.x * width;
    const y = p.y * height;
    const label = LANDMARK_LABELS_ZH[index];
    if (!label) continue;

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    const padX = 4 * unit;
    const padY = 3 * unit;
    const textW = ctx.measureText(label).width;
    ctx.fillRect(x + padX, y - padY - 6 * unit, textW + 2 * padX, 12 * unit + 2 * padY);
    ctx.fillStyle = "#55e6d8";
    ctx.globalAlpha = opacity * 0.95;
    ctx.fillText(label, x + padX + 2 * unit, y - padY);
  }
  ctx.globalAlpha = opacity;
}

export function clearGhostCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
